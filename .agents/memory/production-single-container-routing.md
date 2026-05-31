---
name: Production single-container routing (Docker/Coolify)
description: How /api vs SPA routing must work when the Express API server is the only process (non-Replit deploys).
---

# Production single-container routing

On Replit, the frontend (static service) and the API server are **separate
services** routed by the shared proxy (`/` → erp static, `/api` → api-server).
But on Docker/Coolify/Hostinger VPS the deploy is a **single container**, so the
Express API server must also serve the built SPA.

**Rule:** in `artifacts/api-server/src/app.ts` the order must stay:
1. `app.use("/api", router)` — real API routes
2. `app.use("/api", jsonNotFound)` — unmatched /api returns JSON 404 (never HTML/SPA)
3. `express.static(STATIC_DIR)` + GET-only history fallback that **excludes** `/api`

All of (2)+(3) are gated behind `fs.existsSync(INDEX_HTML)` so Replit dev/prod
(where the build output is not next to the server) stays API-only and unaffected.

**Why:** the original Docker/root `start` ran only `vite preview`, so the API
server never ran and Vite's SPA fallback swallowed every `/api` request
(`GET /api/auth/me` → index.html, `POST /api/auth/logout` → 404).

**How to apply / gotchas:**
- Use `app.use(...)` middleware for the SPA fallback, NOT `app.get("*")` —
  Express 5 / path-to-regexp v8 breaks `"*"`.
- `STATIC_DIR` resolves from `FRONTEND_DIST` env, else `__dirname/../../erp/dist/public`
  (esbuild banner sets `__dirname` to the api-server `dist` dir).
- Vite `build.outDir` is `dist/public` to match `artifact.toml` `publicDir` AND
  `FRONTEND_DIST`. If you change one, change all three in lockstep.
- Dockerfile and root `package.json` `start` must both build erp + api-server
  and run `node artifacts/api-server/dist/index.mjs` with `FRONTEND_DIST` set —
  never `vite preview`.
