---
name: Backup restore — dynamic SQL safety
description: Restoring user-uploaded backup files must allow-list column identifiers and strictly match company_id.
---

Restoring a backup re-inserts rows from a user-uploaded JSON package, so the
column names in each row are UNTRUSTED input. Building `INSERT (col1, col2, ...)`
from `Object.keys(row)` is an SQL-injection sink even with `"..."` quoting.

**Rule:** Build the insert column list ONLY from trusted DB metadata. For each
table query `information_schema.columns`, keep an `allowedCols` set, and intersect
the uploaded row keys against it (`Object.keys(row).filter(k => allowedCols.has(k))`).
Unknown keys are silently dropped, never interpolated into SQL.

**Rule:** The same-company guard must be strict — require `pkg.companyId` to exist
AND equal the current tenant (reject with 400 otherwise). A nullable/optional
check (`pkg.companyId != null && ...`) lets a crafted package omit companyId and
bypass the check, risking cross-tenant global-serial id collisions.

**Why:** Code review flagged both. A restore that runs without these is a
tenant→database compromise vector in this multi-tenant ERP.

**How to apply:** Any endpoint that re-inserts externally-supplied table dumps
(restore, import) under SERIALIZABLE delete-then-insert must do both checks. Also
remember: a restore/reset that wipes `users` for the active company logs out the
caller (their session user row vanishes → requireAdmin 403); recover by
re-inserting from a backup directly via the pool.
