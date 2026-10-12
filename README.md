# Node.js (Express) & PostgreSQL Task Application

A clean, production-ready REST API and web application built using Node.js, Express, and PostgreSQL (`pg`).

---

## 📁 Project Structure

```text
2534_RudreshGaonkar_Assignment6/
├── app.js          # Express app, REST API endpoints, DB connection & HTML frontend
├── package.json    # Project dependencies and run scripts
├── schema.sql      # Database schema (creates `tasks` table)
├── .env.example    # Environment variable template
└── README.md       # Setup & execution instructions
```

---

## ⚙️ Prerequisites

1. **Node.js** (v16.x or higher) and **npm** installed.
2. **PostgreSQL** database server installed and running.

---

## 🚀 Setup & Installation

### 1. Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file from `.env.example`:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On Linux / macOS / Bash:**
```bash
cp .env.example .env
```

Update `.env` with your PostgreSQL database credentials if they differ from the defaults:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=appdb
```

---

## 🗄️ Database Setup

Ensure the database specified in `DB_NAME` (e.g. `appdb`) exists in PostgreSQL:

```bash
# Create database (if not already created)
createdb -U postgres appdb
```

Execute `schema.sql` to initialize the `tasks` table:

```bash
# Using psql CLI
psql -U postgres -d appdb -f schema.sql
```

*(Note: `app.js` will also automatically execute `CREATE TABLE IF NOT EXISTS tasks ...` on initial boot if the table does not exist).*

---

## ▶️ Running the Application

### Start in Production Mode:
```bash
npm start
```

### Start in Development Mode (Auto-restart on change):
```bash
npm run dev
```

Once running, access the web application at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description | Sample Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Serves the HTML/JS web frontend | _None_ |
| `GET` | `/api/tasks` | Returns all tasks (ordered by newest first) | _None_ |
| `POST` | `/api/tasks` | Creates a new task | `{"title": "Buy groceries"}` |
| `GET` | `/api/health` | Health check (checks server and database connectivity) | _None_ |

### Example cURL Commands

**Add a new task:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Complete Cloud Lab Assignment"}'
```

**Retrieve all tasks:**
```bash
curl http://localhost:3000/api/tasks
```
