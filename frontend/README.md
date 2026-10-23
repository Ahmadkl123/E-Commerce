# E-Commerce Frontend (Kestrel)

React storefront and admin inventory dashboard for the **E-Commerce Application with CI/CD** project.
It consumes the REST API in [`../backend`](../backend).

Built with **React 19**, **Vite**, **React Router**, and **Playwright** for end-to-end tests.

## Features

| Area | What it does | Backend endpoints |
|---|---|---|
| **Storefront** | Home page (hero, categories, bestsellers, new arrivals), shop page with category / availability filters, sorting and header search | `GET /api/products?search=` |
| **Product page** | Details, stock status, quantity picker capped at available stock | `GET /api/products/:id` |
| **Auth** | Sign in, register (client-side validation mirrors the backend), session kept in `localStorage`, auto-logout on expired JWT | `POST /api/auth/login`, `POST /api/auth/register` |
| **Cart** | Slide-out cart drawer with free-shipping progress, full cart page, change quantities, remove items | `GET/POST /api/cart`, `DELETE /api/cart/:productId` |
| **Checkout & account** | One-click checkout, account page with order history | `POST /api/orders`, `GET /api/orders` |
| **Admin dashboard** | Inventory stats (units, value, low stock), filter table, create / edit / delete products | `POST/PUT/DELETE /api/products` (admin JWT) |

Light retail design with real product photography (credits in [`public/images/CREDITS.md`](public/images/CREDITS.md)), responsive from phone to desktop.

The backend has no image or category fields, so both are derived from the product name in [`src/catalog.js`](src/catalog.js). New products created in the admin get a matching photo when their name contains a known keyword (e.g. "keyboard", "headphones"), otherwise a neutral placeholder.

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
  catalog.js             # product -> photo / category mapping
  context/               # Auth (JWT session), Cart (+ drawer state), Toast providers
  components/            # Header, Footer, CartDrawer, ProductCard, Icons, QuantityStepper, RequireAuth
  pages/                 # Home, Shop, ProductDetail, Cart, Account, Login, Register
  pages/admin/           # AdminDashboard, ProductForm
  styles.css             # design tokens + all styles
public/images/           # product and site photography
e2e/                     # Playwright specs + API mock
```
