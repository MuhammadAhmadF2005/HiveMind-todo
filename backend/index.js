require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// CRITICAL: Force application to crash if env vars are missing
const requiredEnvVars = ['JWT_SECRET', 'DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`FATAL ERROR: Environment variable ${varName} is not defined.`);
    process.exit(1); // Exit with failure
  }
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool — Uses environment variables directly
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
});

//  Auto-build tables if they don't exist
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('🐘 Users table synchronized!');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false,
        flair VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'Medium',
        due_date DATE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP DEFAULT NULL
      );
    `);
    console.log('🐘 Todos table synchronized!');

    // Add index to speed up user-specific query filtering
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos (user_id);
    `);
    console.log('🐘 Index on todos(user_id) synchronized!');

    // Migration: add completed_at column for existing databases
    await pool.query(`
      ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT NULL;
    `);
    console.log('🐘 Todos table migration (completed_at) applied!');
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
  }
};
//  Auth Middleware — verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user; // user = { id, email }
    next();
  });
};

//  Input Validation
const validateTodoInput = (title, flair, priority) => {
  const errors = [];
  
  if (!title || title.trim().length === 0) {
    errors.push('Title is required.');
  }
  
  if (title && title.length > 255) {
    errors.push('Title must be 255 characters or less.');
  }

  const validFlairs = ['Coursework', 'Sport/Athleticism', 'Home/Personal', 'Commitments', 'Research', 'Work'];
  if (!validFlairs.includes(flair)) {
    errors.push(`Flair must be one of: ${validFlairs.join(', ')}`);
  }

  const validPriorities = ['High', 'Medium'];
  if (!validPriorities.includes(priority)) {
    errors.push(`Priority must be either 'High' or 'Medium'.`);
  }

  return errors;
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper to add isOverdue flag based on date parts (ignoring hours)
const enrichTodoWithOverdue = (todo) => {
  if (!todo || !todo.dueDate || todo.completed) {
    return { ...todo, isOverdue: false };
  }
  const [year, month, day] = todo.dueDate.split('-').map(Number);
  const dueDateLocal = new Date(year, month - 1, day);
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  return {
    ...todo,
    isOverdue: dueDateLocal < todayLocal
  };
};

// AUTHENTICATION ENDPOINTS

// SIGNUP
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Type checking validation to prevent type-based crashes
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password must be strings.' });
    }

    if (!email.trim() || !password.trim()) {
      return res.status(400).json({ error: 'Email and password cannot be empty.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'Account created successfully!', token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('❌ POST /auth/signup error:', err.message);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// 🔓 LOGIN
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password must be strings.' });
    }

    if (!email.trim() || !password.trim()) {
      return res.status(400).json({ error: 'Email and password cannot be empty.' });
    }

    // Find user
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful!', token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('❌ POST /auth/login error:', err.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

//  TODO ENDPOINTS (Protected)

// 🔄 FETCH ALL TODOS FOR LOGGED-IN USER
app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        completed, 
        flair, 
        priority, 
        TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", 
        user_id AS "userId",
        completed_at AS "completedAt",
        CASE 
          WHEN due_date < CURRENT_DATE AND completed = false THEN true 
          ELSE false 
        END AS "isOverdue"
      FROM todos 
      WHERE user_id = $1
      ORDER BY due_date ASC NULLS LAST, priority DESC, created_at DESC
    `, [userId]);

    res.json(result.rows.map(enrichTodoWithOverdue));
  } catch (err) {
    console.error('❌ GET /api/todos error:', err.message);
    res.status(500).json({ error: 'Server error pulling task entities.' });
  }
});

// ➕ INSERT NEW TODO
app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, flair, dueDate, priority } = req.body;

    // Validate input
    const validationErrors = validateTodoInput(title, flair, priority);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const formattedDate = dueDate === '' || !dueDate ? null : dueDate;

    const result = await pool.query(
      `INSERT INTO todos (title, flair, due_date, priority, user_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING 
         id, 
         title, 
         completed, 
         flair, 
         priority, 
         TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", 
         user_id AS "userId",
         completed_at AS "completedAt",
         CASE 
           WHEN due_date < CURRENT_DATE AND completed = false THEN true 
           ELSE false 
         END AS "isOverdue"`,
      [title.trim(), flair, formattedDate, priority, userId]
    );

    res.status(201).json(enrichTodoWithOverdue(result.rows[0]));
  } catch (err) {
    console.error('❌ POST /api/todos error:', err.message);
    res.status(500).json({ error: 'Server error creating task.' });
  }
});

// ✏️ UPDATE TODO
app.patch('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { completed, title, priority } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    // Check if todo belongs to user
    const todoCheck = await pool.query('SELECT user_id FROM todos WHERE id = $1', [id]);
    if (todoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    if (todoCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (completed !== undefined) {
      updates.push(`completed = $${paramIndex}`);
      values.push(completed);
      paramIndex++;

      // Track when a task was completed (or un-completed)
      if (completed) {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }
      updates.push(`title = $${paramIndex}`);
      values.push(title.trim());
      paramIndex++;
    }

    if (priority !== undefined) {
      const validPriorities = ['High', 'Medium'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value.' });
      }
      updates.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE todos 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
         id, 
         title, 
         completed, 
         flair, 
         priority, 
         TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", 
         user_id AS "userId",
         completed_at AS "completedAt",
         CASE 
           WHEN due_date < CURRENT_DATE AND completed = false THEN true 
           ELSE false 
         END AS "isOverdue"`,
      values
    );

    res.json(enrichTodoWithOverdue(result.rows[0]));
  } catch (err) {
    console.error('❌ PATCH /api/todos/:id error:', err.message);
    res.status(500).json({ error: 'Server error updating task.' });
  }
});

// 🗑️ DELETE TODO
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    // Check ownership
    const todoCheck = await pool.query('SELECT user_id FROM todos WHERE id = $1', [id]);
    if (todoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    if (todoCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id, title', [id]);

    res.json({ message: 'Task purged successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ DELETE /api/todos/:id error:', err.message);
    res.status(500).json({ error: 'Server error deleting task.' });
  }
});

// 🔧 Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'HiveMind operational ✨' });
});

// 🧹 Auto-Purge Engine — permanently removes completed tasks older than 5 days
const AUTO_PURGE_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
const purgeOldCompletedTasks = async () => {
  try {
    const result = await pool.query(
      `DELETE FROM todos WHERE completed_at IS NOT NULL AND completed_at < NOW() - INTERVAL '5 days'`
    );
    if (result.rowCount > 0) {
      console.log(`🧹 Auto-purge: Removed ${result.rowCount} completed task(s) older than 5 days.`);
    }
  } catch (err) {
    console.error('❌ Auto-purge error:', err.message);
  }
};

const startServer = async () => {
  await initDb();
  await purgeOldCompletedTasks();
  
  if (process.env.NODE_ENV !== 'test') {
    setInterval(purgeOldCompletedTasks, AUTO_PURGE_INTERVAL_MS);

    app.listen(PORT, () => {
      console.log(`🚀 HiveMind Enterprise Core operational on port ${PORT}`);
    });
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, pool, initDb, purgeOldCompletedTasks };