---
name: Order lifecycle authorization
description: How non-admin roles are allowed to move customer_orders through their status lifecycle, and why it must be transition-based.
---

# Customer-order status transition authorization

The `PATCH /customer-orders/:id/status` endpoint is shared by admin, salesman, and
manufacturing. Authorization must validate the actual `from_status -> to_status`
transition per role, **not** just whether the target status is in a per-role set.

**Why:** A target-set-only check let any role force illogical jumps (e.g.
`cancelled -> production`, `pending -> delivered`). Worse, workload-card auto-creation
fires on entry into production statuses, so an invalid rewrite could resurrect
manufacturing demand for orders that were already cancelled/dispatched/delivered.

**How to apply:**
- Admin: unrestricted.
- Salesman: only their OWN order, only when it is still a draft (`is_draft === true`)
  or `pending`, and only into `processing`/`production`/`cancelled` (submit or cancel a draft).
- Manufacturing: forward-only production/dispatch transitions with an explicit
  `allowedFrom` map (production←processing/production; ready_for_dispatch←processing/
  production; dispatched←ready_for_dispatch; delivered←dispatched).
- Workload-card creation on entering a production status must skip terminal/post-
  production source states (cancelled/dispatched/delivered/done).
- The GET list endpoint must include `manufacturing` in the "see all orders" branch
  (it needs the ready-for-dispatch queue); customer/salesman remain scoped to own rows.

**Pricing tie-in:** salesman-created orders are priced at `wholesalePrice` (fallback
retail) to match the salesman order-entry UI; customers are priced at retail. Keep
the POST pricing source aligned with whatever tier the originating UI displays.
