# Multi-Service Cloud E-Commerce Application

A lightweight, production-ready microservices architecture built with **Node.js (Express)**, **PostgreSQL**, and **Docker Compose**, designed for multi-VM deployment across separate cloud virtual machines.

---

## 🏗️ Architecture Overview

```text
                              ┌───────────────────────────────────┐
                              │     VM 1: API Gateway (8080)      │
                              │  - Serves Modern Dashboard UI     │
                              │  - Unified REST API Proxy Router  │
                              └─────────────────┬─────────────────┘
                                                │
          ┌─────────────────────────────────────┼─────────────────────────────────────┐
          │                                     │                                     │
          ▼                                     ▼                                     ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│     VM 2: Catalog (4001)      │ │      VM 3: Orders (4002)     │ │      VM 4: Users (4003)       │
│ - Products & Inventory API    │ │ - Order Processing & Workflow │ │ - Profile & Loyalty Points    │
│ - Dedicated PostgreSQL DB     │ │ - Inter-service Event Sync    │ │ - DB Sync Payload Listener    │
│                               │ │ - Dedicated PostgreSQL DB     │ │ - Dedicated PostgreSQL DB     │
└───────────────┬───────────────┘ └───────────────┬───────────────┘ └───────────────┬───────────────┘
                │                                 │                                 │
                ▼                                 ▼                                 ▼
         [PostgreSQL DB]                   [PostgreSQL DB]                   [PostgreSQL DB]
          (catalogdb)                       (ordersdb)                        (usersdb)
```

### Automatic Inter-Service Synchronization
When an order is submitted:
1. **Orders Service** reserves product and persists the order record in `ordersdb`.
2. **Orders Service** notifies **Catalog Service** (`PATCH /products/:id/stock`) to decrement real-time inventory.
3. **Orders Service** sends an event sync payload to **Users Service** (`POST /users/sync-order`) to credit loyalty points and update purchase history in `usersdb`.

---

## 📁 Repository Directory Structure

```text
2534_RudreshGaonkar_Assignment6/
├── gateway/                    # Microservice 1: Gateway & UI Dashboard
│   ├── index.js
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── catalog/                    # Microservice 2: Catalog Service + DB
│   ├── index.js
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── orders/                     # Microservice 3: Orders Service + DB
│   ├── index.js
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── users/                      # Microservice 4: Users Service + DB
│   ├── index.js
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── docker-compose.yml          # Root compose file for single-host testing
└── README.md
```

---

## 🚀 Deployment Instructions Per VM

### Prerequisites on Each VM
- Docker and Docker Compose installed:
  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose
  sudo systemctl enable --now docker
  ```
- Clone this repository on each VM:
  ```bash
  git clone https://github.com/RudreshGaonkar/test.git
  cd test
  ```

---

### Step 1: Deploy VM 2 (Catalog Service)
1. Navigate to the `catalog` directory:
   ```bash
   cd catalog
   ```
2. Start the service and its local PostgreSQL database:
   ```bash
   docker-compose up -d --build
   ```
3. Test locally on the VM:
   ```bash
   curl http://localhost:4001/products
   ```
*(Take note of this VM's IP address: e.g., `192.168.1.101`)*

---

### Step 2: Deploy VM 4 (Users Service)
1. Navigate to the `users` directory:
   ```bash
   cd users
   ```
2. Start the service and its local PostgreSQL database:
   ```bash
   docker-compose up -d --build
   ```
3. Test locally on the VM:
   ```bash
   curl http://localhost:4003/users
   ```
*(Take note of this VM's IP address: e.g., `192.168.1.103`)*

---

### Step 3: Deploy VM 3 (Orders Service)
The Orders Service connects to both Catalog and Users services for real-time inventory and loyalty point synchronization.

1. Navigate to the `orders` directory:
   ```bash
   cd orders
   ```
2. Create your `.env` configuration file and specify the IPs of VM 2 and VM 4:
   ```bash
   cat << 'EOF' > .env
   PORT=4002
   DB_HOST=orders-db
   DB_PORT=5432
   DB_USER=orders_user
   DB_PASSWORD=orders_pass
   DB_NAME=ordersdb
   CATALOG_SERVICE_URL=http://<VM_CATALOG_IP>:4001
   USERS_SERVICE_URL=http://<VM_USERS_IP>:4003
   EOF
   ```
3. Start the service:
   ```bash
   docker-compose --env-file .env up -d --build
   ```
*(Take note of this VM's IP address: e.g., `192.168.1.102`)*

---

### Step 4: Deploy VM 1 (API Gateway & Web Dashboard)
1. Navigate to the `gateway` directory:
   ```bash
   cd gateway
   ```
2. Create `.env` referencing the IPs of the three microservices:
   ```bash
   cat << 'EOF' > .env
   PORT=8080
   CATALOG_SERVICE_URL=http://<VM_CATALOG_IP>:4001
   ORDERS_SERVICE_URL=http://<VM_ORDERS_IP>:4002
   USERS_SERVICE_URL=http://<VM_USERS_IP>:4003
   EOF
   ```
3. Launch the gateway container:
   ```bash
   docker-compose --env-file .env up -d --build
   ```
4. **Access the Web Dashboard:**
   Open your browser and navigate to:
   👉 `http://<VM_GATEWAY_IP>:8080`

---

## 🧪 Quick Test: Running All Services on a Single Host

To test all 4 services and their 3 respective PostgreSQL databases on a single machine or VM:

```bash
# In the root repository directory
docker-compose up -d --build
```

Then visit **`http://localhost:8080`** to view the live dashboard, view products, select users, and place synchronized orders.

---

## 📡 API Reference Summary

| Service | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| **Gateway** | `/` | `GET` | Interactive E-Commerce Dashboard |
| **Gateway** | `/api/health` | `GET` | Health check probe of all 3 microservices |
| **Catalog** | `/products` | `GET` / `POST` | List or create catalog items |
| **Catalog** | `/products/:id/stock`| `PATCH` | Update / decrement item inventory |
| **Orders** | `/orders` | `GET` / `POST` | List or place order with automated inter-service sync |
| **Users** | `/users` | `GET` / `POST` | List users or create user account |
| **Users** | `/users/sync-order` | `POST` | Sync endpoint called by Orders service |
