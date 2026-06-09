---
name: Express router mount ordering with path-less guards
description: Why some sub-routers must be mounted before others in the API server's route index.
---

A router that applies an authorization guard at the router level WITHOUT a path
prefix (e.g. a `super_admin`/`requireRole` middleware registered as
`router.use(guard)` rather than scoped to a sub-path) will reject requests for
ANY route mounted after it on the same parent router.

**Why:** Express runs `use` middleware in registration order. A path-less guard
on the subscriptions router was intercepting later-mounted routers (print
settings / gstin), returning 403 before their handlers ran.

**How to apply:** In `artifacts/api-server/src/routes/index.ts`, mount
broadly-readable routers (print-settings, gstin) BEFORE any router that installs
a path-less role guard (subscriptions). If you add a new generally-accessible
route and start getting unexpected 403s, check mount order relative to
guard-heavy routers first.
