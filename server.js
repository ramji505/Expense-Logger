const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = require('prom-client');

// Automatically collect default system metrics (CPU, RAM, Event Loop)
client.collectDefaultMetrics();

// Expose /metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database pool configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'expense_logger_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Initialize Database connection and tables
async function initDB() {
  try {
    // Attempt connection to MySQL server to ensure DB exists
    const rootConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await rootConnection.end();

    // Create pooled connection to the database
    pool = mysql.createPool(dbConfig);

    // Create expenses table if it does not exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        expense_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log('Connected to MySQL and verified "expenses" table.');
  } catch (err) {
    console.error('MySQL initialization error:', err.message);
    console.error('Please verify your MySQL server status and .env settings.');
  }
}

// Endpoint: Save an expense
app.post('/api/expenses', async (req, res) => {
  try {
    const { title, amount, category, expense_date } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Expense title is required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid positive amount.' });
    }

    const dateToSave = expense_date || new Date().toISOString().split('T')[0];
    const categoryToSave = category && category.trim() ? category.trim() : 'General';

    if (!pool) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database is not connected. Please check MySQL server and .env credentials.' 
      });
    }

    const insertQuery = `
      INSERT INTO expenses (title, amount, category, expense_date)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertQuery, [
      title.trim(),
      parsedAmount,
      categoryToSave,
      dateToSave
    ]);

    return res.status(201).json({
      success: true,
      message: 'Expense saved successfully!',
      expense: {
        id: result.insertId,
        title: title.trim(),
        amount: parsedAmount,
        category: categoryToSave,
        expense_date: dateToSave
      }
    });
  } catch (error) {
    console.error('Error saving expense:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while saving expense.',
      error: error.message
    });
  }
});

// Endpoint: Get all saved expenses (to display recent saved expenses)
app.get('/api/expenses', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database is not connected.' 
      });
    }

    const [rows] = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC');
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching expenses.',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  await initDB();
});
