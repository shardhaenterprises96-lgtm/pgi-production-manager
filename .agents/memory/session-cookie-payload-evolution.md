---
name: Session cookie payload evolution
description: Why stale signed-cookie sessions break after adding a field, and the self-heal pattern.
---

Sessions are stored as plain JSON inside a signed cookie (no server-side store); each request just `JSON.parse`s the cookie. When a NEW required field is added to the session payload (e.g. `companyId` for tenant isolation), every cookie issued before that change deserializes WITHOUT the field. Any code that hard-requires it (e.g. `getCompanyId` throwing 403 "No tenant context") then fails on every data route for already-logged-in users — even though the DB row is correct and a fresh login would work.

**Why:** there is no migration path for in-flight cookies; logout/login is the only manual fix, which is a terrible UX dead-end.

**How to apply:** the identity-refresh endpoint (`GET /auth/me`, called by the SPA on load) must RE-STAMP `req.session` from the current DB user, not just return JSON. The response middleware serializes `req.session` back into the cookie, so a stale session self-heals on the next page load. Whenever you add a field to the login session payload, mirror it in the `/auth/me` re-stamp block too.

**Trap — re-stamp must PRESERVE session-only fields (no DB column):** the re-stamp rebuilds `req.session` as a fresh object from the DB row. Any field that lives ONLY in the session and has no DB column — `activeCompanyId` (super_admin's switched-into tenant) and `companySwitch` (validated dedicated-mode unlock) — is silently dropped if not explicitly carried over from the existing session, and the response middleware then rewrites the cookie WITHOUT it. Symptom that bit us: super_admin switches company (cookie gets activeCompanyId), the company switcher immediately refetches `/auth/me`, the re-stamp wipes activeCompanyId, and every company-scoped route then returns 409 "Select a company to continue" while the UI still shows a company selected (because the `/auth/me` response body read activeCompanyId from the OLD session object before reassignment). Always merge session-only fields back in: `activeCompanyId: session.activeCompanyId ?? null, companySwitch: session.companySwitch ?? false`. Did NOT reproduce via a curl switch→entities test because that skipped the `/auth/me` call the browser makes in between.
