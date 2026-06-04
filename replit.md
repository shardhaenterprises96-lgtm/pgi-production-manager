# Shradha Enterprises ERP

A production-ready hybrid ERP and B2B E-Commerce web application for Shradha Enterprises (Vipro Brand) — a lubricating oil and grease trading/manufacturing company.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/erp run dev` — run the ERP frontend (port 18996, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter (routing) + TanStack Query
- API: Express 5 + Drizzle ORM + pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)
- Session: signed cookie (`cookie-parser`)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `lib/db/src/schema/` — all Drizzle schema tables (users, products, entities, invoices, payments, rewards, manufacturing, audit)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, products, entities, invoices, payments, rewards, manufacturing, dashboard)
- `artifacts/erp/src/pages/` — all frontend pages
- `artifacts/erp/src/contexts/` — React auth context

## Architecture decisions

- **Contract-first API**: OpenAPI spec defined first; React hooks and Zod validators generated automatically via Orval — never write raw fetch or manual hooks.
- **Immutable stock ledger**: Stock only ever changes via `stock_movements` inserts + `products.current_stock` update in the same transaction. Never direct UPDATE to current_stock alone.
- **SERIALIZABLE transactions for money**: Invoice creation, payment approval, and manufacturing completion all use `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE` via the raw pg pool client.
- **Escrow payment flow**: Payments logged by salesmen are `pending`; admin payments auto-approve and immediately debit the customer ledger.
- **Invoice deletion (admin-only)**: Cancelling any invoice — GST or non-GST — marks it Cancelled but does NOT touch inventory. Stock is left as-is because the goods have usually already left the premises; every cancellation is recorded in the audit log for traceability.
- **Server-side invoice numbering**: `invoice_sequence` table with month/year + counter; generated inside SERIALIZABLE transaction to avoid duplicates.
- **Signed cookie sessions**: No JWT, no localStorage — sessions stored in HttpOnly signed cookies using `SESSION_SECRET`.
- **Flat password storage (dev mode)**: Passwords stored plaintext for demo. Replace with bcrypt before production.

## Product

- **Multi-role auth**: admin, salesman, store, manufacturing, accountant, customer (B2B portal)
- **Amazon-style product catalog**: Visual product cards with stock indicators, dual pricing (retail/wholesale), cart sidebar
- **GST/Non-GST billing**: Full invoice POS with line items, HSN codes, tax breakup, dual unit (boxes/liters) input, print layout
- **Customer Khata ledger**: Per-customer transaction history with running balance
- **Inventory management**: Product CRUD, immutable stock movement log, opening stock
- **Payment escrow**: Salesman payments held pending admin approval; approve/reject queue
- **Volume reward schemes**: Progress tracking per customer per product, disburse rewards
- **Manufacturing pipeline**: BOM master, workload Kanban (pending/processing/done), auto stock adjustment on completion
- **Dashboard**: KPI cards, sales trend chart, low stock alerts, recent invoices, top products
- **Reports**: Ledger report, system audit log
- **Role permissions**: Admin-controlled feature permission matrix per role
- **SaaS Subscription Management (admin-only)**: Tenant companies + plans (monthly/quarterly/half_yearly/yearly), dashboard widgets (active/expired/suspended/expiring, MRR/ARR), recharts analytics, color-coded expiry table (green >30d, orange ≤30d, red expired), renew/upgrade/downgrade/suspend/activate, automated daily alerts (30/15/7/3/0 days), PDF/Excel/CSV export. Expired/suspended tenant client users are blocked at login (admin exempt).

## Seed / Test Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Salesman | salesman1 | pass123 |
| Store | store1 | pass123 |
| Manufacturing | mfg1 | pass123 |
| Accountant | accountant1 | pass123 |
| Customer | customer1 | pass123 |

## User preferences

- No emojis in UI — use Lucide icons throughout
- Dark sidebar with warm amber/saffron brand accents (Vipro brand colors)
- Dense, information-rich enterprise layout (not a consumer app)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after schema changes before restarting the API server
- The `pool` export from `@workspace/db` is used directly in routes that need SERIALIZABLE transactions
- `ilike` from drizzle-orm doesn't accept null columns — wrap nullable columns with `sql` template literal
- Stock movements are the source of truth; `current_stock` is a derived materialized column

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
