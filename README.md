# SAACH Pharmaceuticals — Invoice Generator

A monorepo containing a proforma invoice generator for SAACH Pharmaceuticals, along with a backend API server and shared libraries.

## What it does

The main app (`saach-invoice`) lets you create professional pharmaceutical proforma invoices with:

- Dynamic product rows with live amount calculations
- GST breakdown (5% on products, 18% on inventory charges, none on cylinder charges)
- 30% advance calculation
- PDF export (styled A4 layout via html2pdf.js)
- Excel export (formatted spreadsheet via ExcelJS)
- Pre-populated company details, bank info, and terms & conditions

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, Radix UI |
| Backend | Express 5, Drizzle ORM, PostgreSQL |
| Validation | Zod, drizzle-zod |
| API Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Build | esbuild (API), Vite (frontend) |
| Monorepo | pnpm workspaces, TypeScript 5.9 composite projects |

## Project Structure

```
├── artifacts/
│   ├── saach-invoice/        # React invoice generator (main app)
│   ├── api-server/           # Express 5 API backend
│   └── mockup-sandbox/       # UI component sandbox
├── lib/
│   ├── db/                   # Drizzle ORM + PostgreSQL schema
│   ├── api-spec/             # OpenAPI spec + Orval config
│   ├── api-zod/              # Generated Zod schemas
│   └── api-client-react/     # Generated React Query hooks
├── scripts/                  # Utility scripts
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js 24+
- pnpm (required — yarn/npm are blocked by the preinstall script)

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the invoice app (dev server on http://localhost:5173)
pnpm --filter @workspace/saach-invoice run dev

# Run the API server (requires PORT env var)
PORT=3000 pnpm --filter @workspace/api-server run dev
```

## Build & Typecheck

```bash
# Typecheck + build all packages
pnpm run build

# Typecheck only
pnpm run typecheck
```

## API Server

- Mounts all routes under `/api`
- `GET /api/healthz` — health check
- Uses `@workspace/db` for persistence and `@workspace/api-zod` for request/response validation

## License

MIT
