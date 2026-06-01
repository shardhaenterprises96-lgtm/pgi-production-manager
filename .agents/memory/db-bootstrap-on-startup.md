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
