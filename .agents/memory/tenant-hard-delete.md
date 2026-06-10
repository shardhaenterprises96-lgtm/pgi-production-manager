---
name: Tenant hard-delete coverage
description: What a full tenant (company) delete must wipe, and why coverage is manual.
---

Deleting a tenant company entirely (super_admin subscription delete) must remove, in one SERIALIZABLE txn: every table in the `COMPANY_TABLES` allow-list (reverse order) PLUS `backups`, `backup_settings`, `subscription_alerts`, `subscriptions`, then `companies`.

**Why:** `company_id` columns are plain integers with NO database-level foreign keys, so there is no ON DELETE CASCADE. Nothing stops or cleans up orphaned rows automatically — coverage is entirely manual. `COMPANY_TABLES` deliberately EXCLUDES the platform/management tables (companies, subscriptions, subscription_alerts) and the backup tables, so a hard delete must append those explicitly or they leak.

**How to apply:** Reuse `COMPANY_TABLES` (artifacts/api-server/src/lib/company-data.ts) for the business-data sweep, then explicitly delete the excluded management + backup tables. Derive table identifiers only from the allow-list (never request input); key every delete on the server-resolved company_id. If a new tenant-scoped table is added, add it to COMPANY_TABLES or the hard-delete will orphan its rows.
