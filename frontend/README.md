# E-Commerce Frontend (Nova Store)

React storefront and admin inventory dashboard for the **E-Commerce Application with CI/CD** project.
It consumes the REST API in [`../backend`](../backend).

Built with **React 19**, **Vite**, **React Router**, and **Playwright** for end-to-end tests.

## Features

| Area | What it does | Backend endpoints |
|---|---|---|
| **Storefront** | Hero landing, catalog grid, server-side search, sorting, "in stock only" filter | `GET /api/products?search=` |
| **Product page** | Details, stock status, quantity picker capped at available stock | `GET /api/products/:id` |
| **Auth** | Sign in, register (client-side validation mirrors the backend), session kept in `localStorage`, auto-logout on expired JWT | `POST /api/auth/login`, `POST /api/auth/register` |
| **Cart** | Change quantities, remove items, order summary | `GET/POST /api/cart`, `DELETE /api/cart/:productId` |
| **Checkout & orders** | One-click checkout, order history with line items | `POST /api/orders`, `GET /api/orders` |
| **Admin dashboard** | Inventory stats (units, value, low stock), filter table, create / edit / delete products | `POST/PUT/DELETE /api/products` (admin JWT) |

Responsive from phone to desktop, with a dark theme, loading skeletons, and toast notifications.

## Getting started

```bash
# 1. Start the backend first (see ../backend/README.md) — it listens on http://localhost:5000
# 2. Then, in this folder:
npm install
npm run dev
```

Open http://localhost:5173. In development Vite proxies `/api` to `http://localhost:5000`
(override with `BACKEND_URL=http://host:port npm run dev`).

Demo accounts (from the backend seed). The login page has quick-fill buttons for them:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Customer | `customer@example.com` | `customer123` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test:e2e` | Run Playwright E2E tests (desktop + mobile) |
| `npm run test:e2e:ui` | Playwright interactive UI mode |

## Configuration

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL baked into production builds | empty (same origin / dev proxy) |

Copy `.env.example` to `.env` to set it.

## End-to-end tests

Tests live in [`e2e/`](e2e) and run in Chromium at desktop and mobile (Pixel 7) sizes.

The backend is **mocked inside the browser** with an in-memory fake ([`e2e/mock-api.js`](e2e/mock-api.js)) that
mirrors the real controllers' responses. That means `npm ci && npx playwright install chromium && npm run test:e2e`
runs in any CI pipeline with no MySQL or Express server.

Covered flows: catalog and search, filters, product detail, auth guard redirects, login errors, registration
validation, session persistence and logout, add to cart → change quantity → checkout → order history,
admin-only access, inventory filters, and admin product create / edit / delete with validation.

## Project structure

```
src/
  api/client.js          # fetch wrapper + every backend endpoint
  context/               # Auth (JWT session), Cart, Toast providers
  components/            # Navbar, ProductCard, ProductVisual, QuantityStepper, RequireAuth
  pages/                 # Home, ProductDetail, Cart, Orders, Login, Register
  pages/admin/           # AdminDashboard, ProductForm
  styles.css             # design tokens + all styles
e2e/                     # Playwright specs + API mock
```
