---
name: Tenant isolation in raw SQL transactions
description: Every raw-SQL statement inside SERIALIZABLE money transactions must carry a company_id predicate, not just the ORM reads.
---

# Tenant isolation in raw SQL transactions

In multi-tenant mode, **every** `SELECT`/`UPDATE`/`DELETE` against a tenant-scoped table
(`products`, `entities`, `invoices`, `invoice_items`, `stock_movements`, `ledger_entries`)
must be filtered by `company_id`, including the raw `client.query(...)` statements inside
SERIALIZABLE transactions — not only the high-level drizzle reads.

**Why:** It is easy to scope the obvious list/read endpoints and miss the raw SQL buried in
POST/PATCH transaction bodies that are keyed only by `id` / `invoice_id`. A statement like
`UPDATE products SET current_stock = ... WHERE id = $2` lets tenant A submit a foreign
`productId` / `customerId` and mutate tenant B's stock or ledger — a silent cross-tenant
corruption, not just a read leak. The architect review caught this after the ORM reads were
already scoped.

**How to apply:**
- Add `AND company_id = $n` to every UPDATE/DELETE/SELECT/`FOR UPDATE` on a tenant table;
  bind the session `companyId` (from `getCompanyId(req)`) and renumber params.
- Scope drizzle product-name lookups too: `and(eq(table.companyId, companyId), eq(table.id, x))`.
- Stamp `company_id` on every INSERT.
- A foreign id then updates 0 rows (no corruption) instead of touching another tenant.
- When adding ANY new invoice/stock/ledger SQL in future, keep the predicate or isolation
  silently regresses.
