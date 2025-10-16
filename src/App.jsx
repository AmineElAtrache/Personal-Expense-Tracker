import { useState, useEffect } from 'react';
import { getExpenses, addExpense as addToDB, updateExpense as updateInDB, deleteExpense as deleteFromDB } from './db';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { v4 as uuidv4 } from 'uuid';

// Register Chart.js components for bar chart
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Backend API base URL
const API_BASE = 'http://localhost:3001';
// Available expense categories
const categories = ['Food', 'Transport', 'Rent', 'Entertainment', 'Other'];

function App() {
  // State for storing list of expenses
  const [expenses, setExpenses] = useState([]);
  // State for online/offline status
  const [isOnline, setIsOnline] = useState(false);
  // State for form inputs (amount, description, category, date)
  const [form, setForm] = useState({ amount: '', description: '', category: 'Food', date: new Date().toISOString().split('T')[0] });
  // State for editing mode (holds the expense being edited)
  const [editing, setEditing] = useState(null);
  // State for sync status (true when syncing with server)
  const [syncing, setSyncing] = useState(false);

  // Function to check if server is reachable (determines online status)
  const checkOnline = async () => {
    try {
      await fetch(`${API_BASE}/expenses`, { method: 'HEAD' });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  };

  // Effect to initialize app: check online, load expenses, set up event listeners
  useEffect(() => {
    checkOnline();
    loadExpenses();
    const handleOnline = () => checkOnline();
    const handleOffline = () => checkOnline();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(checkOnline, 5000); // Check every 5 seconds
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Effect to sync expenses when coming online
  useEffect(() => {
    if (isOnline) {
      syncExpenses();
    }
  }, [isOnline]);

  // Load expenses from server (if online) or local DB (if offline)
  const loadExpenses = async () => {
    try {
      if (isOnline) {
        const response = await fetch(`${API_BASE}/expenses`);
        const serverExpenses = await response.json();

        // Mark server items as synced
        const serverWithFlag = serverExpenses.map(exp => ({ ...exp, synced: true }));

        // Load local DB and keep any pending (unsynced) local items so they don't disappear from the UI
        const localExpenses = await getExpenses();
        const pendingLocal = localExpenses.filter(le => !le.synced);

        // Avoid duplicates: include only pending local items that aren't present on the server yet
        const serverIds = new Set(serverWithFlag.map(s => s.id));
        const pendingNotOnServer = pendingLocal.filter(p => !serverIds.has(p.id));

        const merged = [...serverWithFlag, ...pendingNotOnServer];
        setExpenses(merged);

        // Update/overwrite local DB with server canonical records
        for (const exp of serverWithFlag) {
          await updateInDB(exp);
        }
      } else {
        const localExpenses = await getExpenses();
        setExpenses(localExpenses);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      // Fallback to local
      const localExpenses = await getExpenses();
      setExpenses(localExpenses);
    }
  };

  // Sync unsynced expenses to server
  const syncExpenses = async () => {
    setSyncing(true);
    try {
      const localExpenses = await getExpenses();
      for (const exp of localExpenses) {
        if (!exp.synced) {
          await fetch(`${API_BASE}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exp),
          });
          exp.synced = true;
          await updateInDB(exp);
        }
      }
      // Reload from server
      await loadExpenses();
    } catch (error) {
      console.error('Sync error:', error);
    }
    setSyncing(false);
  };

  // Handle form submit: add or edit expense
  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = editing ? editing.id : uuidv4();
    const expense = { id, amount: parseFloat(form.amount), description: form.description, category: form.category, date: form.date, synced: isOnline };
    if (editing) {
      if (isOnline) {
        await fetch(`${API_BASE}/expenses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expense),
        });
      }
      await updateInDB(expense);
      setExpenses(expenses.map(exp => exp.id === id ? expense : exp));
      setEditing(null);
    } else {
      if (isOnline) {
        const response = await fetch(`${API_BASE}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expense),
        });
        const newExp = await response.json();
        expense.id = newExp.id;
      }
      await addToDB(expense);
      setExpenses([...expenses, expense]);
    }
    setForm({ amount: '', description: '', category: 'Food', date: new Date().toISOString().split('T')[0] });
  };

  // Set form for editing an expense
  const handleEdit = (expense) => {
    setForm({ amount: expense.amount, description: expense.description, category: expense.category, date: expense.date });
    setEditing(expense);
  };

  // Delete an expense
  const handleDelete = async (id) => {
    if (isOnline) {
      await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
    }
    await deleteFromDB(id);
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  // Calculate total spending for a given period (today, week, month)
  const getSummary = (period) => {
    const now = new Date();
    let start;
    if (period === 'today') {
      // start of current local day (00:00)
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      // rolling 7-day window back from now
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      // first day of current month at 00:00
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return expenses
      .filter(exp => new Date(exp.date) >= start)
      .reduce((sum, exp) => sum + exp.amount, 0);
  };

  // Data for the bar chart (spending by category)
  const chartData = {
    labels: categories,
    datasets: [{
      label: 'Spending by Category',
      data: categories.map(cat => expenses.filter(exp => exp.category === cat).reduce((sum, exp) => sum + exp.amount, 0)),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
    }],
  };

  // Options for the bar chart
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    layout: { padding: 8 },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.85)' } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.85)' } },
    },
  };

  // Render the UI
  return (
    // Main container with full height and centered content
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '2rem', background: 'transparent' }}>
      <div style={{ padding: '1rem', width: 'min(1200px, 95vw)', margin: '0 auto' }}>
        {/* App title */}
        <h1 className="text-3xl font-bold mb-2 text-center">Personal Expense Tracker</h1>

        {/* Online/offline status indicator */}
        <div className="mb-4 text-center">
          <span className="status-label">Status:</span>
          <span className={isOnline ? 'status-badge online ml-2' : 'status-badge offline ml-2'}>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
          {syncing && <span className="syncing ml-3">Syncing...</span>}
        </div>

        {/* Main grid layout: left column for summaries/chart, right for form/list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Summaries and chart */}
          <div>
            <div className="card" style={{ position: 'relative' }}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Summaries section: Today's, week's, month's spending */}
                <div className="lg:w-1/2">
                  <h2 className="text-xl font-semibold mb-2">Summaries</h2>
                  <div className="summaries">
                    <div className="summary-row">
                      <div className="summary-label">Today</div>
                      <div className="summary-value">{getSummary('today')} USD</div>
                    </div>
                    <div className="summary-row">
                      <div className="summary-label">This Week</div>
                      <div className="summary-value">{getSummary('week')} USD</div>
                    </div>
                    <div className="summary-row">
                      <div className="summary-label">This Month</div>
                      <div className="summary-value">{getSummary('month')} USD</div>
                    </div>
                  </div>
                </div>

                {/* Chart section: Bar chart showing spending by category */}
                <div className="chart-full" style={{ marginTop: 20 }}>
                  <h2 className="text-xl font-semibold mb-3">Spending by Category</h2>
                  <div style={{ width: '100%', height: 360 }}>
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Form and expenses list */}
          <div className="space-y-6">
            {/* Form to add or edit expenses */}
            <form onSubmit={handleSubmit} className="card">
              <h2 className="text-lg font-semibold mb-3">Add Expense</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="form-field" required />
                <input type="text" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-field" required />
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="form-field">
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="form-field" required />
              </div>
              <div className="mt-3 text-right">
                <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add'} Expense</button>
              </div>
            </form>

            {/* List of all expenses with edit/delete buttons */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-2">Recent Expenses</h2>
              <ul className="expenses-list">
                {expenses.map(exp => (
                  <li key={exp.id} className="expense-item">
                    <div className="expense-left">
                      <div className="expense-amount">{exp.amount} USD</div>
                      <div className="expense-desc">{exp.description}</div>
                      <div className="expense-meta">{exp.category} • {exp.date} { !exp.synced && <span className="pending-badge">Pending</span> }</div>
                    </div>
                    <div className="expense-actions">
                      <button onClick={() => handleEdit(exp)} className="btn-small">Edit</button>
                      <button onClick={() => handleDelete(exp.id)} className="btn-small btn-danger">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
