---
name: Drizzle = ANY(jsArray) is broken
description: Why raw `= ANY(${jsArray})` fails in drizzle and what to use instead.
---
Never write `sql\`${col} = ANY(${jsArray})\`` in drizzle. The `sql` template expands a JS array into separate placeholders `($2,$3,$4)`, but Postgres `ANY()` needs a single array argument, so it throws `op ANY/ALL (array) requires array on right side` — failing for ALL multi-element calls (env-independent).

**Why:** drizzle array interpolation targets `IN (...)` semantics, not `ANY(array)`.
**How to apply:** use `inArray(col, jsArray)` for membership checks. Only use `= ANY(...)` in fully raw `pool.query` SQL with an explicit cast like `id = ANY($1::int[])` and a real array param.
