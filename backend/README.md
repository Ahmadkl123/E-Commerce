# E-Commerce Backend API

Backend REST API for the **"E-Commerce Application with Continuous Integration and Deployment (CI/CD)"** school project.

Built with **Node.js (v20+)**, **Express**, **MySQL (via `mysql2/promise`)**, **bcrypt**, and **JSON Web Tokens (JWT)**.

---

## Table of Contents
1. [Tech Stack & Architecture](#tech-stack--architecture)
2. [Prerequisites & MySQL Installation](#prerequisites--mysql-installation)
3. [Database Setup on a New Machine](#database-setup-on-a-new-machine)
4. [Environment Configuration](#environment-configuration)
5. [Installation & Running](#installation--running)
6. [Testing](#testing)
7. [Pre-Seeded Demo Accounts](#pre-seeded-demo-accounts)
8. [API Endpoints Documentation](#api-endpoints-documentation)
9. [Architecture & Design Rationale (For Professor Review)](#architecture--design-rationale-for-professor-review)

---

## Tech Stack & Architecture

- **Runtime**: Node.js v20+
- **Framework**: Express 4
- **Database**: MySQL 8 / MariaDB (relational schema with InnoDB, foreign keys, and utf8mb4)
- **Database Driver**: `mysql2/promise` (connection pooling and parameterized queries, no ORM)
- **Authentication**: `bcrypt` (salted password hashing, 10 rounds) + `jsonwebtoken` (JWT bearer tokens)
- **CORS**: `cors` middleware enabled for frontend integration
- **Testing**: `jest` + `supertest` (mocked DB layer for standalone CI runs)

---

## Prerequisites & MySQL Installation

Before running the application, you need **Node.js (v20+)** and a running **MySQL Server (v8.0+)** or **MariaDB (v10.4+)**.

### Option A: Native Installation (XAMPP or MySQL Server)
- **Windows**:
  - Install [XAMPP](https://www.apachefriends.org/) and start the MySQL module, OR
  - Download and install [MySQL Community Server](https://dev.mysql.com/downloads/mysql/).
- **macOS**:
  ```bash
  brew install mysql
  brew services start mysql
  ```
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install mysql-server
  sudo systemctl start mysql
  ```

### Option B: Docker Alternative (Quick & Isolated)
If you prefer not to install MySQL directly on your operating system, you can run a temporary MySQL container:
```bash
docker run --name ecommerce-mysql -e MYSQL_ROOT_PASSWORD=rootpassword -p 3306:3306 -d mysql:8
```

---

## Database Setup on a New Machine

All database creation, schema definitions, and seed data are stored in pure SQL files under [`database/`](file:///c:/Users/Rog/Desktop/E-Commerce/backend/database):
- `database/schema.sql`: Creates database `ecommerce_db`, drops tables in reverse order, and creates all tables with constraints.
- `database/user.sql`: Creates dedicated application user `ecommerce_user` and grants restricted privileges on `ecommerce_db`.
- `database/seed.sql`: Populates database with sample admin, customer, and 10 products.

### Exact CLI Commands in Order (Using MySQL CLI)

Run these three commands in your terminal from the `backend/` directory:

```bash
# 1. Create database and tables
mysql -u root -p < database/schema.sql

# 2. Create application user and grant permissions
mysql -u root -p < database/user.sql

# 3. Seed demo users and catalog products
mysql -u root -p < database/seed.sql
```

### Alternative: Using NPM Scripts (Cross-Platform)

For environments where the `mysql` CLI is not in your system PATH (e.g. Windows XAMPP) or PowerShell where `<` redirection is not supported, convenient cross-platform npm scripts are provided:

```bash
# Setup database schema, user, and seed data:
npm run db:setup

# Reset database (recreates schema and re-seeds data without recreating the user):
npm run db:reset
```
*Note*: `npm run db:setup` and `npm run db:reset` use the `DB_ROOT_USER` and `DB_ROOT_PASSWORD` configured in your `.env` file (defaults to `root` with no password).

### How to Check that Database Setup Worked

Log into MySQL as the newly created user and verify tables and records:

```bash
mysql -u ecommerce_user -p ecommerce_db
# Enter password: ecommerce_password

SHOW TABLES;
# Expected output:
# +------------------------+
# | Tables_in_ecommerce_db |
# +------------------------+
# | cart_items             |
# | order_items            |
# | orders                 |
# | products               |
# | users                  |
# +------------------------+

SELECT COUNT(*) FROM products;
# Expected output: 10

SELECT id, email, role FROM users;
# Expected output:
# 1 | admin@example.com    | admin
# 2 | customer@example.com | customer
```

---

## Environment Configuration

Copy `.env.example` to `.env` and adjust the variables if your MySQL configuration differs:

```bash
cp .env.example .env
```

| Variable | Description | Default Value |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `DB_HOST` | MySQL hostname | `localhost` |
| `DB_PORT` | MySQL TCP port | `3306` |
| `DB_USER` | Application database username | `ecommerce_user` |
| `DB_PASSWORD` | Application database password | `ecommerce_password` |
| `DB_NAME` | Database schema name | `ecommerce_db` |
| `DB_ROOT_USER` | Root user for `npm run db:setup` | `root` |
| `DB_ROOT_PASSWORD`| Root password for `npm run db:setup` | *(empty string)* |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens | `ecommerce_jwt_dev_secret_key_12345` |

---

## Installation & Running

### 1. Install Dependencies
```bash
npm install
# or for a clean production install:
npm ci
```

### 2. Start the Server

- **Development Mode (auto-reloads on file change)**:
  ```bash
  npm run dev
  ```
- **Standard Production Mode**:
  ```bash
  npm start
  ```

The server will be available at: `http://localhost:5000`

---

## Testing

The project uses **Jest** and **Supertest** for testing.

### Running Automated Tests
```bash
npm test
```

### Unit Tests without Database (Zero-Dependency)
- All test suites in `tests/app.test.js` mock the database layer (`src/db.js`).
- **Why?** This ensures that `npm ci && npm test` runs successfully out-of-the-box on a clean clone or in CI/CD pipelines (like GitHub Actions) without requiring a running MySQL server.

### Real MySQL Database Verification
If you want to run live end-to-end integration requests against a running MySQL database:
1. Ensure your MySQL server is running.
2. Run `npm run db:reset` to seed clean data.
3. Test using `curl.exe` or Postman following the examples below.

---

## Pre-Seeded Demo Accounts

The database seed contains two pre-configured user accounts with real bcrypt hashes (salt rounds = 10):

| Role | Email | Plain Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@example.com` | `admin123` | Full catalog management (Create, Update, Delete products) |
| **Customer** | `customer@example.com` | `customer123` | View catalog, manage cart, checkout orders |

---

## API Endpoints Documentation

All error responses follow the standard JSON format:
```json
{
  "error": "Descriptive error message"
}
```

### 1. Health Check
- **`GET /health`**
  - **Auth**: None
  - **Response `200 OK`**:
    ```json
    { "status": "ok" }
    ```

---

### 2. Authentication
- **`POST /api/auth/register`**
  - **Auth**: None
  - **Body**:
    ```json
    {
      "email": "newuser@example.com",
      "password": "mypassword123"
    }
    ```
  - **Response `201 Created`**:
    ```json
    {
      "message": "User registered successfully",
      "user": { "id": 3, "email": "newuser@example.com", "role": "customer" }
    }
    ```
  - **Errors**: `400 Bad Request` (invalid email or password < 6 chars), `409 Conflict` (email already exists).

- **`POST /api/auth/login`**
  - **Auth**: None
  - **Body**:
    ```json
    {
      "email": "customer@example.com",
      "password": "customer123"
    }
    ```
  - **Response `200 OK`**:
    ```json
    {
      "message": "Login successful",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": { "id": 2, "email": "customer@example.com", "role": "customer" }
    }
    ```
  - **Errors**: `400 Bad Request` (missing credentials), `401 Unauthorized` (invalid email or password).

---

### 3. Products Catalog
- **`GET /api/products`**
  - **Auth**: None
  - **Query Parameters**: `?search=keyword` (optional keyword search on name and description)
  - **Response `200 OK`**:
    ```json
    [
      {
        "id": 1,
        "name": "Wireless Noise-Canceling Headphones",
        "description": "Premium over-ear headphones...",
        "price": 149.99,
        "stock": 45,
        "created_at": "2026-10-15T12:00:00.000Z"
      }
    ]
    ```

- **`GET /api/products/:id`**
  - **Auth**: None
  - **Response `200 OK`**: Single product object.
  - **Errors**: `400 Bad Request` (invalid ID), `404 Not Found` (product not found).

- **`POST /api/products`** *(Admin Only)*
  - **Auth**: `Bearer <token>` (role = admin)
  - **Body**:
    ```json
    {
      "name": "Wireless Gaming Mouse",
      "description": "Ultra-fast sensor with RGB lighting",
      "price": 59.99,
      "stock": 35
    }
    ```
  - **Response `201 Created`**: Created product object.
  - **Errors**: `401 Unauthorized` (no token), `403 Forbidden` (not admin), `400 Bad Request` (validation error).

- **`PUT /api/products/:id`** *(Admin Only)*
  - **Auth**: `Bearer <token>` (role = admin)
  - **Body**: `{ "name": "...", "description": "...", "price": 49.99, "stock": 20 }`
  - **Response `200 OK`**: Updated product object.
  - **Errors**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

- **`DELETE /api/products/:id`** *(Admin Only)*
  - **Auth**: `Bearer <token>` (role = admin)
  - **Response `200 OK`**: `{ "message": "Product deleted successfully" }`
  - **Errors**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

---

### 4. Shopping Cart
- **`GET /api/cart`**
  - **Auth**: `Bearer <token>`
  - **Response `200 OK`**:
    ```json
    {
      "items": [
        {
          "cartItemId": 1,
          "productId": 2,
          "name": "Mechanical Gaming Keyboard",
          "price": 79.99,
          "stock": 30,
          "quantity": 2,
          "subtotal": 159.98
        }
      ],
      "total": 159.98
    }
    ```

- **`POST /api/cart`**
  - **Auth**: `Bearer <token>`
  - **Body**:
    ```json
    {
      "productId": 2,
      "quantity": 1
    }
    ```
  - **Response `200 OK`**: Item added/updated with new quantity and subtotal.
  - **Errors**: `400 Bad Request` (invalid input or quantity exceeds stock), `404 Not Found` (product doesn't exist).

- **`DELETE /api/cart/:productId`**
  - **Auth**: `Bearer <token>`
  - **Response `200 OK`**: `{ "message": "Item removed from cart successfully" }`
  - **Errors**: `404 Not Found` (item not in cart).

---

### 5. Orders & Checkout (Transactional)
- **`POST /api/orders`**
  - **Auth**: `Bearer <token>`
  - **Description**: Atomically checks out all items in the user's cart using an ACID MySQL transaction.
  - **Response `201 Created`**:
    ```json
    {
      "message": "Order created successfully",
      "order": {
        "id": 1,
        "userId": 2,
        "total": 159.98,
        "status": "pending",
        "itemsCount": 1
      }
    }
    ```
  - **Errors**: `400 Bad Request` (empty cart or insufficient stock on an item).

- **`GET /api/orders`**
  - **Auth**: `Bearer <token>`
  - **Response `200 OK`**: Array of user orders including line items and unit price snapshots:
    ```json
    [
      {
        "id": 1,
        "total": 159.98,
        "status": "pending",
        "createdAt": "2026-10-15T12:30:00.000Z",
        "items": [
          {
            "id": 1,
            "productId": 2,
            "productName": "Mechanical Gaming Keyboard",
            "quantity": 2,
            "unitPrice": 79.99,
            "subtotal": 159.98
          }
        ]
      }
    ]
    ```

---

## Architecture & Design Rationale (For Professor Review)

When presenting to your professor, highlight these architectural decisions:

1. **Decoupled Architecture (`src/app.js` vs `src/index.js`)**:
   - `src/app.js` builds the Express instance and registers middleware without calling `.listen()`.
   - `src/index.js` acts solely as the entry point for starting the HTTP listener.
   - *Rationale*: Enables Supertest to test the Express app in-memory without occupying a TCP network port, preventing port binding collisions in automated test runners.

2. **Connection Pooling (`src/db.js`)**:
   - Instead of opening a new TCP connection for every incoming HTTP request, we use `mysql2.createPool()`.
   - *Rationale*: Connection handshakes in MySQL involve TCP three-way handshakes, SSL negotiations, and authentication. A pool keeps a pool of warm connections ready, drastically lowering response times and preventing connection exhaustion under heavy load.

3. **Server-Side Financial Calculations & Snapshot Pricing**:
   - Order totals are strictly calculated from the database price at the time of purchase (`unit_price` in `order_items`).
   - *Rationale*: Client-submitted prices cannot be trusted (users can manipulate client-side JavaScript or HTTP payloads). Storing `unit_price` on `order_items` preserves an immutable audit trail even if catalog prices change in the future.

4. **ACID Transaction Management during Checkout (`src/controllers/ordersController.js`)**:
   - The checkout process wraps stock verification, order creation, inventory decrements, and cart clearing in a transaction:
     ```javascript
     const connection = await pool.getConnection();
     await connection.beginTransaction();
     try {
       // 1. SELECT ... FOR UPDATE (pessimistic lock)
       // 2. Validate stock
       // 3. INSERT orders & order_items
       // 4. UPDATE products stock
       // 5. DELETE cart_items
       await connection.commit();
     } catch (err) {
       await connection.rollback();
     } finally {
       connection.release();
     }
     ```
   - *Rationale*: If a database failure occurs midway through checkout (or stock runs out), `rollback()` ensures that partial data is never committed. The `finally { connection.release(); }` ensures no connection leaks occur.

5. **Security Best Practices**:
   - **SQL Injection Prevention**: All queries use parameterized `?` placeholders.
   - **Password Security**: Passwords are never stored in plain text and are salted & hashed using `bcrypt` (10 rounds). Password hashes are excluded from all JSON API responses.
   - **Role-Based Access Control**: Sensitive catalog operations (`POST`, `PUT`, `DELETE /api/products`) are guarded by `authenticateToken` and `requireAdmin` middleware.
