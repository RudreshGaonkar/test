const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4003;

const pool = new Pool({
  host: process.env.DB_HOST || 'users-db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'users_user',
  password: process.env.DB_PASSWORD || 'users_pass',
  database: process.env.DB_NAME || 'usersdb',
});

app.use(express.json());

const initDb = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      loyalty_points INT DEFAULT 100,
      total_spent NUMERIC(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sync_history (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      order_id INT,
      event_type VARCHAR(80),
      points_earned INT,
      order_amount NUMERIC(10, 2),
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO users (name, email, loyalty_points, total_spent) VALUES
        ('Rudresh Gaonkar', 'rudresh@example.com', 250, 45.00),
        ('John Doe', 'john.doe@example.com', 120, 20.00),
        ('Alice Smith', 'alice@example.com', 300, 110.00);
      `);
      console.log('Users DB seeded with initial users.');
    }
  } catch (err) {
    console.error('Users DB init error:', err.message);
  }
};
initDb();

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'users', status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ service: 'users', status: 'unhealthy', error: err.message });
  }
});

// List users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile
app.get('/users/:id', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const historyRes = await pool.query(
      'SELECT * FROM user_sync_history WHERE user_id = $1 ORDER BY synced_at DESC LIMIT 10',
      [req.params.id]
    );

    res.json({
      ...userRes.rows[0],
      sync_history: historyRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new user profile
app.post('/users', async (req, res) => {
  const { name, email, loyalty_points } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, loyalty_points) VALUES ($1, $2, $3) RETURNING *',
      [name, email, loyalty_points || 100]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SYNC FEATURE: Listens to DB sync payload from Orders service to update user points & history
app.post('/users/sync-order', async (req, res) => {
  const { user_id, order_id, order_amount, points_earned } = req.body;
  if (!user_id || !order_amount) {
    return res.status(400).json({ error: 'user_id and order_amount required in sync payload' });
  }

  const pointsToAdd = points_earned || Math.floor(parseFloat(order_amount));

  try {
    // 1. Update user loyalty points & total spent
    const userUpdate = await pool.query(
      `UPDATE users 
       SET loyalty_points = loyalty_points + $1,
           total_spent = total_spent + $2
       WHERE id = $3
       RETURNING *`,
      [pointsToAdd, parseFloat(order_amount), user_id]
    );

    if (userUpdate.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found to sync order' });
    }

    // 2. Insert into sync audit log
    await pool.query(
      `INSERT INTO user_sync_history (user_id, order_id, event_type, points_earned, order_amount)
       VALUES ($1, $2, 'ORDER_COMPLETED', $3, $4)`,
      [user_id, order_id || null, pointsToAdd, parseFloat(order_amount)]
    );

    res.json({
      synced: true,
      user: userUpdate.rows[0],
      points_added: pointsToAdd
    });
  } catch (err) {
    console.error('Failed to sync order payload to users service:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Users Service running on port ${PORT}`);
});
