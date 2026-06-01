# BigCommerce Bulk Importer

A full-stack web application for bulk importing products, customers, and orders into BigCommerce stores via CSV files. Built with React + Vite (frontend) and Express + PostgreSQL (backend) in a pnpm monorepo.

---

## Features

- **Bulk CSV Import** — Import products, customers, and orders in one upload
- **Multi-store Support** — Manage and switch between multiple BigCommerce stores
- **Order Tracking** — Automatically attach shipment tracking numbers during import
- **Auto Status Update** — Set order status (e.g. Shipped) automatically after import
- **Import History** — View all past imports with per-row success/error logs
- **Retry Failed Rows** — Re-run only the rows that failed without re-uploading
- **CSV Templates** — Download ready-to-fill templates for each import type
- **Currency Management** — Set USD as your store's default currency from the UI
- **Product Images** — Attach images via URL during product imports
- **Manual Order/Product Creation** — Create individual records without CSV

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Express 5, TypeScript, Node.js |
| Database | PostgreSQL (Drizzle ORM) |
| Monorepo | pnpm workspaces |
| API | BigCommerce v2/v3 REST API |

---

## Project Structure

```
BigCommerce-Importerfinalcompleted/
├── artifacts/
│   ├── api-server/          # Express API server (port 3001)
│   │   └── src/
│   │       ├── routes/      # API route handlers
│   │       ├── lib/         # BigCommerce helpers, CSV parser, import runner
│   │       └── middleware/  # Session auth middleware
│   └── bigcommerce-importer/ # React frontend (port 5173)
│       └── src/
│           ├── pages/       # Import wizard, Settings, Templates, History
│           └── components/  # Shared UI components
├── packages/
│   └── db/                  # Drizzle ORM schema + database client
├── pnpm-workspace.yaml
└── package.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) v8 or higher
- PostgreSQL database
- BigCommerce store with API credentials

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/rr5072976-dotcom/BigCommerce-Importerfinalcompleted.git
cd BigCommerce-Importerfinalcompleted
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Create a `.env` file in the project root (or set these in your environment):

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/bigcommerce_importer

# API server port (default: 3001)
API_PORT=3001

# Base path for the frontend (default: /)
BASE_PATH=/
```

### 4. Push the database schema

```bash
pnpm --filter @workspace/db run db:push
```

### 5. Start the development servers

Open two terminals:

**Terminal 1 — API Server:**
```bash
PORT=3001 pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend:**
```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/bigcommerce-importer run dev
```

Then open **http://localhost:5173** in your browser.

---

## BigCommerce API Credentials

You'll need the following from your BigCommerce store:

1. Log in to your BigCommerce admin panel
2. Go to **Settings → API → API Accounts**
3. Create a new API account with the following scopes:
   - **Orders** — Read/Write
   - **Products** — Read/Write
   - **Customers** — Read/Write
   - **Store Information** — Read-only
   - **Order Fulfillment** — Read/Write
4. Note your **Store Hash**, **Client ID**, and **Access Token**

Enter these in the **Settings** page of the app to connect your store.

---

## CSV Format

Download templates from the **Templates** page in the app or from `/api/templates/{type}`.

### Products (`/api/templates/products`)
```
name, type, sku, price, weight, description, inventory_level, image_url
```

### Customers (`/api/templates/customers`)
```
first_name, last_name, email, phone, company
```

### Orders (`/api/templates/orders`)
```
email, first_name, last_name, product_sku, quantity,
street_1, city, state, zip, country, country_iso2,
tracking_number, tracking_carrier, tracking_comments
```

> **Note:** Orders use the product SKU to look up the product. Make sure the product exists in your BigCommerce store before importing orders.

---

## Production Build

```bash
# Build both frontend and API server
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/bigcommerce-importer run build

# Run API server in production
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Orders show wrong currency | Go to Settings → click "Set Default Currency to USD" |
| Image not attached to product | Make sure `image_url` is a publicly accessible HTTPS URL |
| SKU not found during order import | Import the product first, or check the SKU matches exactly |
| Rate limit errors (429) | Enable the import delay option in the import wizard |
| Database connection error | Check `DATABASE_URL` is correct and PostgreSQL is running |

---

## License

MIT
