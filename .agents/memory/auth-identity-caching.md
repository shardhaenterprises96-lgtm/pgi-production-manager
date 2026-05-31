---
name: Auth identity endpoint caching
description: Why /auth/me and any session-setting response must send Cache-Control no-store
---

# Identity/session responses must be non-cacheable

Any API response that conveys auth identity or sets/clears the session cookie
(e.g. `/auth/me`, `/auth/login`, `/auth/logout`, or any route that mutates
`req.session`) MUST send `Cache-Control: no-store` (plus `Pragma: no-cache`,
`Expires: 0`).

**Why:** Express adds a default `ETag` to JSON responses but no `Cache-Control`.
Without `no-store`, the browser can cache the authenticated `200` `/auth/me`
body on disk. Clearing cookies/localStorage/sessionStorage does NOT clear the
HTTP disk cache, so on reload the SPA gets the stale authenticated user from
cache, never hits the server (no 401), and wrongly believes it is logged in
(Welcome page shows, sidebar/permissions inconsistent). A clean browser session
works fine, which makes this look like a phantom bug.

**How to apply:** Header is centralized in the `res.json` patch in
`artifacts/api-server/src/app.ts` (fires whenever `req.session` is set/cleared),
with a defense-in-depth router middleware on the `/auth` router. When adding new
auth/identity endpoints, rely on these — do not reintroduce cacheable identity
responses.
