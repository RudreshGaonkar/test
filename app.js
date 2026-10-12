const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Configuration from environment variables with required defaults
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'appdb',
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auto-initialize table if not exists (for resilient startup)
const initDb = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    console.log('Database initialized: "tasks" table is ready.');
  } catch (err) {
    console.error('Warning: Database connection / initialization failed:', err.message);
  }
};
initDb();

// ----------------------------------------------------
// REST API Endpoints
// ----------------------------------------------------

// GET /api/tasks - Retrieve all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Internal server error while fetching tasks' });
  }
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
      [title.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding task:', err);
    res.status(500).json({ error: 'Internal server error while adding task' });
  }
});

// GET /api/health - Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: err.message });
  }
});

// ----------------------------------------------------
// Minimal HTML / JS Frontend (Served Directly)
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Manager - Cloud CCLab</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #6366f1;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 60%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 16px;
    }
    .container {
      width: 100%;
      max-width: 580px;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    header h1 {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    header p {
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      margin-bottom: 24px;
    }
    form {
      display: flex;
      gap: 12px;
    }
    input[type="text"] {
      flex: 1;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
      background: rgba(15, 23, 42, 0.6);
      color: var(--text);
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="text"]:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25);
    }
    button {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      color: #0f172a;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      padding: 12px 20px;
      font-size: 0.95rem;
      cursor: pointer;
      transition: transform 0.15s ease, opacity 0.2s ease;
      white-space: nowrap;
    }
    button:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(1px);
    }
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .list-header h2 {
      font-size: 1.15rem;
      font-weight: 600;
      color: #e2e8f0;
    }
    .badge {
      font-size: 0.8rem;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      padding: 3px 10px;
      border-radius: 20px;
      font-weight: 600;
    }
    ul.task-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    li.task-item {
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 14px 16px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: transform 0.15s ease, border-color 0.15s;
    }
    li.task-item:hover {
      border-color: rgba(56, 189, 248, 0.3);
      transform: translateX(4px);
    }
    .task-title {
      font-size: 1rem;
      font-weight: 500;
      color: #f1f5f9;
      word-break: break-word;
    }
    .task-date {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .status-toast {
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 0.85rem;
      display: none;
    }
    .status-toast.error {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Task Tracker</h1>
      <p>Node.js & Express with PostgreSQL</p>
    </header>

    <div id="toast" class="status-toast"></div>

    <div class="card">
      <form id="task-form">
        <input 
          type="text" 
          id="task-input" 
          placeholder="Enter a new task title..." 
          required 
          autocomplete="off"
        />
        <button type="submit" id="add-btn">Add Task</button>
      </form>
    </div>

    <div class="card">
      <div class="list-header">
        <h2>Tasks</h2>
        <span id="task-count" class="badge">0</span>
      </div>
      <ul id="task-list" class="task-list">
        <li class="empty-state">Loading tasks...</li>
      </ul>
    </div>
  </div>

  <script>
    const form = document.getElementById('task-form');
    const input = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const countBadge = document.getElementById('task-count');
    const toast = document.getElementById('toast');

    function showError(msg) {
      toast.className = 'status-toast error';
      toast.textContent = msg;
      setTimeout(() => {
        toast.className = 'status-toast';
        toast.textContent = '';
      }, 4000);
    }

    async function fetchTasks() {
      try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const tasks = await response.json();
        renderTasks(tasks);
      } catch (err) {
        taskList.innerHTML = '<li class="empty-state" style="color: #f87171;">Failed to connect to database or server. Check DB configuration.</li>';
      }
    }

    function renderTasks(tasks) {
      countBadge.textContent = tasks.length;
      if (tasks.length === 0) {
        taskList.innerHTML = '<li class="empty-state">No tasks created yet. Add one above!</li>';
        return;
      }

      taskList.innerHTML = tasks.map(task => {
        const date = new Date(task.created_at).toLocaleString();
        return \`
          <li class="task-item">
            <span class="task-title">\${escapeHtml(task.title)}</span>
            <span class="task-date">\${date}</span>
          </li>
        \`;
      }).join('');
    }

    function escapeHtml(str) {
      return str.replace(/[&<>'"]/g, 
        tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
      );
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add task');
        }

        input.value = '';
        fetchTasks();
      } catch (err) {
        showError(err.message);
      }
    });

    fetchTasks();
  </script>
</body>
</html>`);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your web browser`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await pool.end();
    console.log('Database pool and HTTP server closed');
  });
});

module.exports = app;
