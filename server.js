// Import required modules
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// Create Express app
const app = express();
// Set port from environment or default to 3001
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON request bodies

// In-memory storage for expenses (resets on server restart)
let expenses = [];

// Simple disk persistence so data survives server restarts
const DATA_DIR = path.resolve('./data');
const DATA_FILE = path.join(DATA_DIR, 'expenses.json');

const loadFromDisk = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    expenses = JSON.parse(raw) || [];
    console.log(`Loaded ${expenses.length} expenses from disk`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // No file yet — start empty
      expenses = [];
      console.log('No existing data file, starting with empty expenses');
    } else {
      console.error('Failed to load data file:', err);
    }
  }
};

const saveToDisk = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(expenses, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data file:', err);
  }
};

// API Routes

// GET /expenses - Retrieve all expenses
app.get('/expenses', (req, res) => {
  res.json(expenses);
});

// POST /expenses - Create a new expense
app.post('/expenses', async (req, res) => {
  const { id, amount, description, category, date } = req.body;
  // Validate required fields
  if (!id || !amount || !description || !category || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  // Create new expense object
  const newExpense = {
    id,
    amount: parseFloat(amount),
    description,
    category,
    date
  };
  // Add to in-memory storage
  expenses.push(newExpense);
  // Persist
  await saveToDisk();
  res.status(201).json(newExpense);
});

// PUT /expenses/:id - Update an existing expense
app.put('/expenses/:id', async (req, res) => {
  const id = req.params.id;
  const { amount, description, category, date } = req.body;
  // Find expense by ID
  const expenseIndex = expenses.findIndex(exp => exp.id === id);
  if (expenseIndex === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  // Validate required fields
  if (!amount || !description || !category || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  // Update expense
  expenses[expenseIndex] = {
    id,
    amount: parseFloat(amount),
    description,
    category,
    date
  };
  // Persist
  await saveToDisk();
  res.json(expenses[expenseIndex]);
});

// DELETE /expenses/:id - Delete an expense
app.delete('/expenses/:id', async (req, res) => {
  const id = req.params.id;
  // Find expense by ID
  const expenseIndex = expenses.findIndex(exp => exp.id === id);
  if (expenseIndex === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  // Remove from storage
  expenses.splice(expenseIndex, 1);
  // Persist
  await saveToDisk();
  res.status(204).send();
});

// Load persisted data then start server
(async () => {
  await loadFromDisk();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();