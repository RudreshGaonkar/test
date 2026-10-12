const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  host: process.env.DB_HOST || 'catalog-db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'catalog_user',
  password: process.env.DB_PASSWORD || 'catalog_pass',
  database: process.env.DB_NAME || 'catalogdb',
});

app.use(express.json());

const initDb = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      price NUMERIC(10, 2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    const countRes = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO products (name, price, stock, description) VALUES
        ('Cloud VPS Hosting - 1mo', 12.99, 50, 'High-performance cloud compute unit'),
        ('Managed PostgreSQL DB', 24.50, 25, 'High-availability managed DB cluster'),
        ('SSL Wildcard Certificate', 9.99, 100, 'Security certificate with instant issuance'),
        ('Kubernetes Node Cluster', 79.00, 10, 'Scale-ready container orchestration engine');
      `);
      console.log('Catalog DB seeded with initial products.');
    }
  } catch (err) {
    console.error('Catalog DB init error:', err.message);
  }
};
initDb();

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'catalog', status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ service: 'catalog', status: 'unhealthy', error: err.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/products', async (req, res) => {
  const { name, price, stock, description } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  try {
    const result = await pool.query(
      'INSERT INTO products (name, price, stock, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, price, stock || 0, description || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory/stock (deduct on order placement)
app.patch('/products/:id/stock', async (req, res) => {
  const { quantity, action } = req.body; // action: 'decrement' | 'set'
  const qty = parseInt(quantity, 10);
  if (isNaN(qty)) return res.status(400).json({ error: 'Valid quantity required' });

  try {
    let result;
    if (action === 'decrement') {
      result = await pool.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING *',
        [qty, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Insufficient stock or product not found' });
      }
    } else {
      result = await pool.query(
        'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *',
        [qty, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Catalog Service running on port ${PORT}`);
});
