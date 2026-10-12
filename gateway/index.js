const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configured URLs for downstream microservices
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://10.128.0.9:3001';
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://10.128.0.8:3002';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://10.128.0.10:3003';

app.use(express.json());

// -----------------------------------------------------------------
// Gateway Health & Proxy Status
// -----------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const checkService = async (name, url) => {
    try {
      const resp = await axios.get(`${url}/health`, { timeout: 2500 });
      return { name, status: 'ONLINE', url, data: resp.data };
    } catch (err) {
      return { name, status: 'OFFLINE', url, error: err.message };
    }
  };

  const [catalog, orders, users] = await Promise.all([
    checkService('Catalog Service', CATALOG_SERVICE_URL),
    checkService('Orders Service', ORDERS_SERVICE_URL),
    checkService('Users Service', USERS_SERVICE_URL)
  ]);

  res.json({
    gateway: 'ONLINE',
    port: PORT,
    services: { catalog, orders, users }
  });
});

// -----------------------------------------------------------------
// Route Proxies: Catalog (Forwards /api/catalog and /catalog to CATALOG_SERVICE_URL/products)
// -----------------------------------------------------------------
const getCatalogHandler = async (req, res) => {
  try {
    const targetUrl = req.params.id 
      ? `${CATALOG_SERVICE_URL}/products/${req.params.id}` 
      : `${CATALOG_SERVICE_URL}/products`;
    const resp = await axios.get(targetUrl, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

const postCatalogHandler = async (req, res) => {
  try {
    const resp = await axios.post(`${CATALOG_SERVICE_URL}/products`, req.body, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

const patchCatalogStockHandler = async (req, res) => {
  try {
    const resp = await axios.patch(`${CATALOG_SERVICE_URL}/products/${req.params.id}/stock`, req.body, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

// Support both /api/catalog and /catalog
app.get(['/api/catalog', '/catalog'], getCatalogHandler);
app.get(['/api/catalog/:id', '/catalog/:id'], getCatalogHandler);
app.post(['/api/catalog', '/catalog'], postCatalogHandler);
app.patch(['/api/catalog/:id/stock', '/catalog/:id/stock'], patchCatalogStockHandler);

// Backward compatibility alias for /api/catalog/products
app.get('/api/catalog/products', getCatalogHandler);
app.post('/api/catalog/products', postCatalogHandler);

// -----------------------------------------------------------------
// Route Proxies: Orders (Forwards /api/orders and /orders to ORDERS_SERVICE_URL/orders)
// -----------------------------------------------------------------
const getOrdersHandler = async (req, res) => {
  try {
    const resp = await axios.get(`${ORDERS_SERVICE_URL}/orders`, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

const postOrdersHandler = async (req, res) => {
  try {
    const resp = await axios.post(`${ORDERS_SERVICE_URL}/orders`, req.body, { timeout: 6000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

app.get(['/api/orders', '/orders'], getOrdersHandler);
app.post(['/api/orders', '/orders'], postOrdersHandler);

// -----------------------------------------------------------------
// Route Proxies: Users (Forwards /api/users and /users to USERS_SERVICE_URL/users)
// -----------------------------------------------------------------
const getUsersHandler = async (req, res) => {
  try {
    const targetUrl = req.params.id 
      ? `${USERS_SERVICE_URL}/users/${req.params.id}` 
      : `${USERS_SERVICE_URL}/users`;
    const resp = await axios.get(targetUrl, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

const postUsersHandler = async (req, res) => {
  try {
    const resp = await axios.post(`${USERS_SERVICE_URL}/users`, req.body, { timeout: 4000 });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.response?.data?.error || err.message });
  }
};

app.get(['/api/users', '/users'], getUsersHandler);
app.get(['/api/users/:id', '/users/:id'], getUsersHandler);
app.post(['/api/users', '/users'], postUsersHandler);

// -----------------------------------------------------------------
// Minimal E-Commerce Dashboard UI (HTML / CSS / JS)
// -----------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloud Commerce - Microservices Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --surface: rgba(18, 24, 38, 0.8);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #38bdf8;
      --accent: #818cf8;
      --success: #34d399;
      --danger: #f87171;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0b0f19 75%);
      color: var(--text);
      min-height: 100vh;
      padding: 30px 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 16px;
    }
    header h1 {
      font-size: 1.9rem;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header p { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
    .services-status-bar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 0.8rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #64748b;
    }
    .dot.online { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .dot.offline { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--surface);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .card-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1.15rem;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }
    .btn {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #0b0f19;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: opacity 0.2s, transform 0.15s;
    }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn:active { transform: translateY(1px); }
    .product-list, .orders-list, .users-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    }
    .item-row {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .item-info { display: flex; flex-direction: column; gap: 4px; }
    .item-name { font-weight: 600; font-size: 0.95rem; }
    .item-sub { font-size: 0.8rem; color: var(--text-muted); }
    .tag {
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
    }
    .tag.synced {
      background: rgba(52, 211, 153, 0.15);
      color: var(--success);
    }
    .alert-banner {
      display: none;
      padding: 12px 18px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 0.9rem;
    }
    .alert-banner.success {
      display: block;
      background: rgba(52, 211, 153, 0.15);
      border: 1px solid rgba(52, 211, 153, 0.3);
      color: var(--success);
    }
    .alert-banner.error {
      display: block;
      background: rgba(248, 113, 113, 0.15);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: var(--danger);
    }
    select {
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 12px;
      border-radius: 8px;
      outline: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Cloud Commerce Microservices</h1>
        <p>API Gateway & Distributed Multi-Service Dashboard</p>
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--text-muted);">Active User: </label>
        <select id="user-select"></select>
      </div>
    </header>

    <div class="services-status-bar">
      <div class="status-badge">
        <span class="dot" id="dot-catalog"></span>
        <span>Catalog Service (10.128.0.9:3001)</span>
      </div>
      <div class="status-badge">
        <span class="dot" id="dot-orders"></span>
        <span>Orders Service (10.128.0.8:3002)</span>
      </div>
      <div class="status-badge">
        <span class="dot" id="dot-users"></span>
        <span>Users Service (10.128.0.10:3003)</span>
      </div>
    </div>

    <div id="alert-box" class="alert-banner"></div>

    <div class="grid">
      <!-- 1. Catalog Service Card -->
      <div class="card">
        <div class="card-title">
          <span>Catalog & Inventory</span>
          <span class="tag">PostgreSQL CatalogDB</span>
        </div>
        <div class="product-list" id="products-list">Loading products...</div>
      </div>

      <!-- 2. Orders Service Card -->
      <div class="card">
        <div class="card-title">
          <span>Recent Orders & Sync</span>
          <span class="tag">PostgreSQL OrdersDB</span>
        </div>
        <div class="orders-list" id="orders-list">Loading orders...</div>
      </div>

      <!-- 3. Users Service Card -->
      <div class="card">
        <div class="card-title">
          <span>User Profiles & Loyalty</span>
          <span class="tag">PostgreSQL UsersDB</span>
        </div>
        <div class="users-list" id="users-list">Loading user profiles...</div>
      </div>
    </div>
  </div>

  <script>
    const alertBox = document.getElementById('alert-box');

    function notify(msg, type = 'success') {
      alertBox.className = 'alert-banner ' + type;
      alertBox.textContent = msg;
      setTimeout(() => { alertBox.className = 'alert-banner'; }, 5000);
    }

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        
        setDot('dot-catalog', data.services.catalog.status === 'ONLINE');
        setDot('dot-orders', data.services.orders.status === 'ONLINE');
        setDot('dot-users', data.services.users.status === 'ONLINE');
      } catch (err) {
        setDot('dot-catalog', false);
        setDot('dot-orders', false);
        setDot('dot-users', false);
      }
    }

    function setDot(id, online) {
      const el = document.getElementById(id);
      if (el) el.className = 'dot ' + (online ? 'online' : 'offline');
    }

    async function loadProducts() {
      const list = document.getElementById('products-list');
      try {
        // Calls Gateway proxy /api/catalog which forwards to CATALOG_SERVICE_URL/products
        const res = await fetch('/api/catalog');
        const products = await res.json();
        if (!res.ok || products.error) throw new Error(products.error || 'Failed to load catalog');

        list.innerHTML = products.map(p => \`
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">\${p.name}</span>
              <span class="item-sub">$\${parseFloat(p.price).toFixed(2)} | Stock: <strong>\${p.stock}</strong></span>
            </div>
            <button class="btn" onclick="placeOrder(\${p.id})" \${p.stock <= 0 ? 'disabled' : ''}>
              \${p.stock > 0 ? 'Order Now' : 'Out of Stock'}
            </button>
          </div>
        \`).join('');
      } catch (e) {
        list.innerHTML = '<div style="color:var(--danger)">Failed to load Catalog Service: ' + e.message + '</div>';
      }
    }

    async function loadUsers() {
      const userSelect = document.getElementById('user-select');
      const usersList = document.getElementById('users-list');
      try {
        // Calls Gateway proxy /api/users which forwards to USERS_SERVICE_URL/users
        const res = await fetch('/api/users');
        const users = await res.json();
        if (!res.ok || users.error) throw new Error(users.error || 'Failed to load users');

        userSelect.innerHTML = users.map(u => 
          \`<option value="\${u.id}">\${u.name} (\${u.loyalty_points} pts)</option>\`
        ).join('');

        usersList.innerHTML = users.map(u => \`
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">\${u.name}</span>
              <span class="item-sub">\${u.email}</span>
            </div>
            <div style="text-align:right">
              <span class="tag synced">\${u.loyalty_points} Points</span>
              <div class="item-sub" style="margin-top:4px">Spent: $\${parseFloat(u.total_spent || 0).toFixed(2)}</div>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        usersList.innerHTML = '<div style="color:var(--danger)">Failed to load Users Service: ' + e.message + '</div>';
      }
    }

    async function loadOrders() {
      const list = document.getElementById('orders-list');
      try {
        // Calls Gateway proxy /api/orders which forwards to ORDERS_SERVICE_URL/orders
        const res = await fetch('/api/orders');
        const orders = await res.json();
        if (!res.ok || orders.error) throw new Error(orders.error || 'Failed to load orders');

        if (orders.length === 0) {
          list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">No orders placed yet.</div>';
          return;
        }

        list.innerHTML = orders.map(o => \`
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">\${o.product_name || ('Product #' + o.product_id)}</span>
              <span class="item-sub">User #\${o.user_id} | Qty: \${o.quantity} | Total: $\${parseFloat(o.total_amount).toFixed(2)}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
              <span class="tag \${o.catalog_synced && o.users_synced ? 'synced' : ''}">
                \${o.catalog_synced && o.users_synced ? '✓ Distributed Synced' : 'Sync Pending'}
              </span>
              <span class="item-sub">\${new Date(o.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        list.innerHTML = '<div style="color:var(--danger)">Failed to load Orders Service: ' + e.message + '</div>';
      }
    }

    async function placeOrder(productId) {
      const userId = document.getElementById('user-select').value;
      if (!userId) return notify('Please select a user first', 'error');

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: parseInt(userId, 10),
            product_id: productId,
            quantity: 1
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Order placement failed');

        notify('Order placed! Catalog stock deducted & User loyalty points synced across microservices.');
        loadProducts();
        loadOrders();
        loadUsers();
      } catch (err) {
        notify(err.message, 'error');
      }
    }

    // Initialize UI
    checkHealth();
    loadProducts();
    loadUsers();
    loadOrders();

    setInterval(checkHealth, 8000);
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway & Frontend Service running on port ${PORT}`);
  console.log(`Access dashboard at http://localhost:${PORT}`);
});
