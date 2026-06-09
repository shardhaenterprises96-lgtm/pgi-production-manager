---
name: Deployment-mode auth lock (multi vs dedicated company)
description: How the ERP switches between shared SaaS and single-company deployments, and why the company lock is fail-closed + defense-in-depth.
---

The same ERP codebase serves two deployment shapes, selected at runtime by env vars
(no code change): shared multi-tenant SaaS vs a dedicated install locked to one company.

- `DEFAULT_COMPANY_ID` — the single trigger, keyed on RAW PRESENCE of the env var
  (any non-empty value, even malformed), NOT its parsed value: if SET, dedicated
  single-company mode; if UNSET, shared multi-tenant SaaS (default). Tying the
  trigger to the parsed id would fall open to shared mode on a malformed value.
- `MULTI_COMPANY_MODE` = optional legacy override (`true`/`false`); not required —
  setting `DEFAULT_COMPANY_ID` alone is enough to lock the install.
- `GET /system/config` is PUBLIC (mounted before requireAuth) and returns
  `{ multiCompanyMode, company }` purely so the login screen can show fixed branding.

**Rule:** all access decisions go through one helper, `isAccountAllowedHere(role, companyId)`
in `artifacts/api-server/src/lib/system-config.ts`. Never re-derive the lock inline.

**Why fail-closed:** in dedicated mode, if `DEFAULT_COMPANY_ID` is missing/invalid the
helper denies every non-`super_admin` account rather than silently allowing all — a
misconfigured dedicated box must never fall back to open multi-tenant access. `super_admin`
is always exempt so the operator can log in and fix the config.

**Why defense-in-depth:** the lock is enforced both at `/auth/login` AND on every request
in `requireAuth` (which clears the stale session + 403s). Login-only enforcement would let
a cookie minted before a mode switch (or for another company) keep working until it expired.

**How to apply:** any new auth/session entry point or any change to deployment-mode behavior
must call `isAccountAllowedHere` rather than checking the env flags directly, and must keep
`super_admin` exempt. The frontend `/system/config` value is presentation only — never trust
it for authorization.
