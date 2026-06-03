# Enterprise Employee Management System (HRMS)

This repository hosts a premium, enterprise-grade Employee Management System (HRMS) designed with a clean, executive SaaS aesthetic inspired by products like Linear, Stripe, and Vercel.

---

## Technical Architecture Stack

*   **Frontend**: React 19, TypeScript, Vite, Ant Design (Curated Token Theme), React Router v6, Axios, TanStack React Query v5, Recharts (Donut & Area analytics charts).
*   **Backend**: Node.js, Express, TypeScript, JWT Credentials Shielding, Multer (Document upload handler).
*   **Database Core**: Dual-Mode Database Engine:
    *   **PostgreSQL mode**: Full SQL schemas and indexations.
    *   **Fallback JSON mode**: Local file persistent store (`database.json`) automatically initialized and seeded if PostgreSQL is disabled or offline, making the application immediately runnable and interactive out-of-the-box.

---

## Directory Schema Layout

```
premium-hrms/
├── backend/                  # Express REST API Server
│   ├── src/
│   │   ├── config/           # DB Core and initialization
│   │   ├── controllers/      # Route controllers (Auth, Dashboard, Employees)
│   │   ├── middleware/       # JWT auth shields, Multer uploads
│   │   ├── routes/           # REST endpoints mapping
│   │   ├── types/            # TypeScript schemas
│   │   └── server.ts         # Backend Express bootstrapper
│   └── database.json         # Seeding/Fallback JSON database
├── frontend/                 # React 19 Application (Vite)
│   ├── src/
│   │   ├── components/       # Metric cards and shared assets
│   │   ├── context/          # JWT state contexts
│   │   ├── layouts/          # Left Sidebar, Header wrappers
│   │   ├── pages/            # Core views (Dashboard, Directory, Wizard)
│   │   ├── services/         # Axios wrapper bindings
│   │   ├── styles/           # CSS overrides
│   │   └── App.tsx           # Router mappings & ConfigProvider
├── schema.sql                # PostgreSQL Schema Script
└── README.md                 # Deployment & Onboarding guide
```

---

## Database Configuration

### 1. Fallback JSON Database (Default)
By default, the backend runs in fallback mode using `backend/database.json`. This file is automatically created and seeded with 12 realistic employee profiles, department manager structures, historical activities, and files on the first launch. No PostgreSQL installation is required.

### 2. PostgreSQL Configuration
To connect to a live PostgreSQL database:
1.  Run the DDL scripts in `schema.sql` inside your PostgreSQL server to create the database tables and indexes.
2.  Edit the environment variables in `backend/.env`:
    ```env
    DB_ENABLED=true
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=your_postgres_username
    DB_PASSWORD=your_postgres_password
    DB_DATABASE=your_database_name
    ```
3.  Start the backend. It will detect PostgreSQL and auto-seed the database tables with default datasets if they are empty.

---

## Launch Configurations

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### Direct Concurent Launch (Recommended)
From the project root directory, run:
```bash
# Installs concurrently in the root and launches both development servers in parallel
npm run dev
```

### Manual Individual Launches
If you prefer running the servers in separate terminal panes:

**Backend Express API**:
```bash
cd backend
npm install
npm run dev
# Starts REST API listening on http://localhost:5000
```

**Frontend React App**:
```bash
cd frontend
npm install
npm run dev
# Starts Vite Server on http://localhost:5173
```

---

## Onboarding & Demo Credentials

When logging in to the seeded environment, use the following pre-configured credentials:

### 1. Administrator Account
*   **Email**: `sarah.j@enterprise.io`
*   **Password**: `password123`
*   **Privileges**: Full read/write directory access, bulk removals, and department configurations.

### 2. Manager Account
*   **Email**: `aisha.r@enterprise.io`
*   **Password**: `password123`
*   **Privileges**: Employee updates and skills catalog management.

### 3. Employee Account
*   **Email**: `marcus.v@enterprise.io`
*   **Password**: `password123`
*   **Privileges**: Read-only directory access and personal profile management.
