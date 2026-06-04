---
name: base64 image storage
description: Why this ERP stores uploaded images as base64 data URLs in text columns instead of object storage/filesystem.
---

# Base64 image storage convention

Uploaded images (product photos, ledger/khata attachments) are stored as base64 `data:image/...;base64,...` strings in plain `text` columns, NOT on disk or in object storage.

**Why:** the app deploys to BOTH Replit and a single-container Coolify/Hostinger VPS. The Coolify filesystem is ephemeral and no object storage is configured, so a DB-resident data URL is the only thing portable across both targets. There is existing precedent (the products table image column uses the same scheme).

**How to apply:**
- Client converts the file with `FileReader.readAsDataURL` and caps size (~3MB raw) before sending.
- The Express JSON body limit is already raised to `10mb` in `app.ts` to fit base64 payloads — keep it there.
- ALWAYS re-validate server-side (mime allowlist via `^data:image/(png|jpe?g|webp|gif);base64,...$` + decoded-byte cap). Client checks are bypassable via direct API calls and unchecked blobs bloat the DB.
