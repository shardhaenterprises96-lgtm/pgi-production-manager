---
name: DB bootstrap on startup
description: How/why the API server auto-creates the schema from production-schema.sql on an empty production DB.
---

# Startup DB bootstrap

The API server runs an idempotent bootstrap before `app.listen`: if `public.users`
is missing it applies the repo-root `production-schema.sql`, then ensures the default
admin via `INSERT ... ON CONFLICT (username) DO NOTHING`.

**Why:** single-container (Coolify/Hostinger) deploys point at a fresh empty Postgres
that no migration step ever touches — every DB-backed endpoint 500s until the schema
exists. There are no drizzle migration files (project uses `drizzle-kit push` in dev only),
so a runtime bootstrap is the only thing that initializes prod.

**How to apply / gotchas:**
- `production-schema.sql` is generated with `pg_dump --schema-only` and is the runtime
  source of truth; it MUST stay git-tracked so the Docker `COPY . .` ships it. cwd at
  runtime is `/app` (container) so the file resolves; locally cwd is the package dir, so
  the locator walks parent dirs up to repo root.
- pg_dump emits psql meta-commands (`\restrict` / `\unrestrict`). node-postgres cannot
  execute them — strip every backslash-prefixed line before `client.query(sql)`.
- Use a DEDICATED `pg.Client` for bootstrap, not the shared pool. The dump runs
  `set_config('search_path','')`; if that session returned to the pool, later drizzle
  queries (unqualified table names) would fail to resolve tables.
- Bootstrap never throws — it logs and lets the server still boot (health stays up).

## Copying dev data into a fresh production DB
The agent CANNOT write to the Replit production DB (executeSql prod is read-only and
there is no prod connection string in dev). The only write path is the app itself.
To migrate real dev data into a fresh prod DB: ship a conflict-safe data dump as a
git-tracked file (`production-seed-data.sql`) and have the startup bootstrap load it
**gated on an empty business table** (e.g. `products`), inside one transaction, then
have the user re-publish so the prod app restarts and runs the seed.
**Why gated + conflict-safe:** the seed must be a no-op once data exists and survive
re-runs across restarts. Use `pg_dump --data-only --column-inserts --on-conflict-do-nothing`
(it also emits `setval` for every sequence — keeps PKs from colliding with new rows).
**Gotchas:**
- Multi-tenant: prod's seeded users may have NULL `company_id`; the seed must UPSERT
  users to attach them to the right company or they won't see the copied data.
- Exclude `users` from the plain dump and handle them with an explicit
  `ON CONFLICT (id) DO UPDATE` so existing prod accounts get synced, not skipped.
- `production-schema.sql` drifts from the live dev schema (it missed multi-tenant
  `company_id` columns). Regenerate it from `pg_dump --schema-only` whenever you rely
  on the schema→seed chain, or a fresh deploy applies a stale schema and the seed fails.
- Real Replit prod schema comes from the publish-time diff, not this file — verify with
  a read-only `information_schema.columns` query before trusting either.
