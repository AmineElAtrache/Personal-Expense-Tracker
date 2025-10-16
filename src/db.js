// Import IndexedDB library
import { openDB } from 'idb';

// Database configuration
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 1;

// Initialize IndexedDB database
export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object store for expenses if it doesn't exist
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
    },
  });
};

// Add a new expense to IndexedDB
export const addExpense = async (expense) => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readwrite');
  const store = tx.objectStore('expenses');
  await store.add(expense);
  await tx.done;
};

// Retrieve all expenses from IndexedDB
export const getExpenses = async () => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readonly');
  const store = tx.objectStore('expenses');
  return await store.getAll();
};

// Update an existing expense in IndexedDB
export const updateExpense = async (expense) => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readwrite');
  const store = tx.objectStore('expenses');
  await store.put(expense);
  await tx.done;
};

// Delete an expense from IndexedDB by ID
export const deleteExpense = async (id) => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readwrite');
  const store = tx.objectStore('expenses');
  await store.delete(id);
  await tx.done;
};