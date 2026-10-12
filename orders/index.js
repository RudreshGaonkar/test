const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4002;

const pool = new Pool({
  host: process.env.DB_HOST || 'orders-db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'orders_user',
  password: process.env.DB_PASSWORD || 'orders_pass',
  database: process.env.DB_NAME || 'ordersdb',
});

// Inter-service endpoints configured via environment variables
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://localhost:4003';

app.use(express.json());

const initDb = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(150),
      quantity INT NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'CONFIRMED',
      catalog_synced BOOLEAN DEFAULT FALSE,
      users_synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('Orders DB initialized.');
  } catch (err) {
    console.error('Orders DB init error:', err.message);
  }
};
initDb();

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'orders', status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ service: 'orders', status: 'unhealthy', error: err.message });
  }
});

// List all orders
app.get('/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders by user
app.get('/orders/user/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SYNC FEATURE: Create an order, then auto-sync with Catalog and Users microservices
app.post('/orders', async (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  const qty = parseInt(quantity, 10) || 1;
  const uId = parseInt(user_id, 10);
  const pId = parseInt(product_id, 10);

  if (!uId || !pId) {
    return res.status(400).json({ error: 'user_id and product_id are required' });
  }

  try {
    // 1. Fetch product details from Catalog Service
    let product;
    try {
      const prodRes = await axios.get(`${CATALOG_SERVICE_URL}/products/${pId}`, { timeout: 4000 });
      product = prodRes.data;
    } catch (e) {
      return res.status(502).json({ error: `Failed to contact Catalog Service: ${e.message}` });
    }

    if (!product || product.stock < qty) {
      return res.status(400).json({ error: `Insufficient inventory for product #${pId}` });
    }

    const unitPrice = parseFloat(product.price);
    const totalAmount = parseFloat((unitPrice * qty).toFixed(2));

    // 2. Insert order record into Orders DB
    const orderRes = await pool.query(
      `INSERT INTO orders (user_id, product_id, product_name, quantity, unit_price, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED') RETURNING *`,
      [uId, pId, product.name, qty, unitPrice, totalAmount]
    );
    const order = orderRes.rows[0];

    // 3. SYNC STEP A: Deduct stock in Catalog Service
    let catalogSynced = false;
    try {
      await axios.patch(`${CATALOG_SERVICE_URL}/products/${pId}/stock`, {
        quantity: qty,
        action: 'decrement'
      }, { timeout: 4000 });
      catalogSynced = true;
    } catch (e) {
      console.error('Catalog inventory sync failed:', e.message);
    }

    // 4. SYNC STEP B: Sync points and order history with Users Service
    let usersSynced = false;
    try {
      await axios.post(`${USERS_SERVICE_URL}/users/sync-order`, {
        user_id: uId,
        order_id: order.id,
        order_amount: totalAmount,
        points_earned: Math.floor(totalAmount * 2) // 2 loyalty points per dollar
      }, { timeout: 4000 });
      usersSynced = true;
    } catch (e) {
      console.error('Users order history sync failed:', e.message);
    }

    // 5. Update sync flags in orders record
    await pool.query(
      'UPDATE orders SET catalog_synced = $1, users_synced = $2 WHERE id = $3',
      [catalogSynced, usersSynced, order.id]
    );

    res.status(201).json({
      ...order,
      catalog_synced: catalogSynced,
      users_synced: usersSynced,
      message: 'Order placed and synchronized successfully across microservices'
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orders Service running on port ${PORT}`);
});
