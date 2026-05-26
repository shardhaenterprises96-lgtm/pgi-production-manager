import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { pool, db, productsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const ORDER_STATUSES = ["pending", "processing", "done", "cancelled"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

function formatOrder(row: any) {
  return {
    id: row.id,
    orderNo: row.order_no ?? null,
    userId: row.user_id ?? null,
    entityId: row.entity_id ?? null,
    customerName: row.customer_name,
    customerMobile: row.customer_mobile ?? null,
    status: row.status as OrderStatus,
    totalItems: Number(row.total_items ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    notes: row.notes ?? null,
    adminRemarks: row.admin_remarks ?? null,
    createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : row.updated_at,
  };
}

function formatItem(r: any) {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    unit: r.unit ?? null,
    qty: Number(r.qty),
    unitPrice: Number(r.unit_price),
    lineTotal: Number(r.line_total),
    workloadCardId: r.workload_card_id ?? null,
  };
}

// POST /customer-orders — customer (own) or admin
router.post("/customer-orders", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (session.role !== "customer" && session.role !== "admin") {
    res.status(403).json({ error: "Only customers can place orders" });
    return;
  }

  const body = req.body ?? {};
  const items: Array<{ productId: number; qty: number }> = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: "Order must have at least one item" });
    return;
  }

  // Resolve customer info — prefer linked entity for role=customer
  let customerName = String(body.customerName ?? session.name ?? session.username ?? "").trim();
  let customerMobile = String(body.customerMobile ?? "").trim() || null;
  let entityId: number | null = body.entityId != null ? Number(body.entityId) : null;

  if (session.role === "customer") {
    const entRows = await pool.query(
      `SELECT id, name, mobile FROM entities WHERE user_id = $1 AND type = 'customer' LIMIT 1`,
      [session.userId]
    );
    if (entRows.rows[0]) {
      entityId = entRows.rows[0].id;
      if (!customerName) customerName = entRows.rows[0].name;
      if (!customerMobile) customerMobile = entRows.rows[0].mobile ?? null;
    }
  }
  if (!customerName) customerName = session.name ?? session.username ?? "Customer";

  // Fetch product info for pricing snapshot
  const productIds = Array.from(new Set(items.map((i) => Number(i.productId)).filter((x) => Number.isFinite(x))));
  const products = productIds.length
    ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  let totalItems = 0;
  const resolvedItems: Array<{
    productId: number; productName: string; unit: string | null; qty: number; unitPrice: number; lineTotal: number;
  }> = [];

  for (const it of items) {
    const pid = Number(it.productId);
    const qty = Number(it.qty);
    if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
    const p = byId.get(pid);
    if (!p) continue;
    const price = Number(p.retailPrice ?? 0);
    const lineTotal = qty * price;
    resolvedItems.push({
      productId: pid,
      productName: p.name,
      unit: p.unit ?? null,
      qty,
      unitPrice: price,
      lineTotal,
    });
    totalAmount += lineTotal;
    totalItems += qty;
  }
  if (resolvedItems.length === 0) {
    res.status(400).json({ error: "No valid items in order" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Customer-placed orders go directly to "processing" so the manufacturing
    // team sees them on the workload board immediately.
    const initialStatus = session.role === "customer" ? "processing" : "pending";
    const ins = await client.query(
      `INSERT INTO customer_orders
         (user_id, entity_id, customer_name, customer_mobile, status, total_items, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [session.userId, entityId, customerName, customerMobile, initialStatus, totalItems, totalAmount, body.notes ?? null]
    );
    const order = ins.rows[0];

    const d = new Date(order.created_at);
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const orderNo = `ORD-${ym}-${String(order.id).padStart(5, "0")}`;
    await client.query(`UPDATE customer_orders SET order_no = $1 WHERE id = $2`, [orderNo, order.id]);
    order.order_no = orderNo;

    for (const it of resolvedItems) {
      const itemIns = await client.query(
        `INSERT INTO customer_order_items
           (order_id, product_id, product_name, unit, qty, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [order.id, it.productId, it.productName, it.unit, it.qty, it.unitPrice, it.lineTotal]
      );
      // Auto-create workload card for customer orders so manufacturing
      // sees the demand right away.
      if (initialStatus === "processing") {
        const wlIns = await client.query(
          `INSERT INTO workload_cards (product_id, target_qty, status, order_type, reference_order_id)
           VALUES ($1, $2, 'pending', 'customer_backorder', $3)
           RETURNING id`,
          [it.productId, it.qty, order.id]
        );
        await client.query(
          `UPDATE customer_order_items SET workload_card_id = $1 WHERE id = $2`,
          [wlIns.rows[0].id, itemIns.rows[0].id]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json(formatOrder(order));
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    req.log?.error({ err }, "customer-order create failed");
    res.status(500).json({ error: err?.message ?? "Server error" });
  } finally {
    client.release();
  }
});

// GET /customer-orders — admin: all; customer: own
router.get("/customer-orders", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const status = typeof req.query.status === "string" ? String(req.query.status) : null;
  const params: any[] = [];
  const where: string[] = [];

  if (session.role === "customer") {
    params.push(session.userId);
    where.push(`user_id = $${params.length}`);
  } else if (session.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const sqlText = `SELECT * FROM customer_orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 200`;
  const result = await pool.query(sqlText, params);
  res.json(result.rows.map(formatOrder));
});

// GET /customer-orders/:id — admin or owner
router.get("/customer-orders/:id", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const head = await pool.query(`SELECT * FROM customer_orders WHERE id = $1`, [id]);
  const order = head.rows[0];
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (session.role === "customer") {
    if (order.user_id !== session.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } else if (session.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const itemsRes = await pool.query(`SELECT * FROM customer_order_items WHERE order_id = $1 ORDER BY id ASC`, [id]);
  res.json({
    ...formatOrder(order),
    items: itemsRes.rows.map(formatItem),
  });
});

// PATCH /customer-orders/:id/status — admin only
router.patch("/customer-orders/:id/status", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (session?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const newStatus = String(req.body?.status ?? "");
  if (!(ORDER_STATUSES as readonly string[]).includes(newStatus)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const adminRemarks: string | null = req.body?.adminRemarks ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query(
      `SELECT * FROM customer_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Not found" });
      return;
    }

    // On transition to processing, create workload cards for each item that
    // doesn't already have one.
    if (newStatus === "processing" && existing.status !== "processing" && existing.status !== "done") {
      const itemsRes = await client.query(
        `SELECT * FROM customer_order_items WHERE order_id = $1`,
        [id]
      );
      for (const it of itemsRes.rows) {
        if (it.workload_card_id) continue;
        const ins = await client.query(
          `INSERT INTO workload_cards (product_id, target_qty, status, order_type, reference_order_id)
           VALUES ($1, $2, 'pending', 'customer_backorder', $3)
           RETURNING id`,
          [it.product_id, it.qty, id]
        );
        await client.query(
          `UPDATE customer_order_items SET workload_card_id = $1 WHERE id = $2`,
          [ins.rows[0].id, it.id]
        );
      }
    }

    const upd = await client.query(
      `UPDATE customer_orders
         SET status = $1,
             admin_remarks = COALESCE($2, admin_remarks),
             updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newStatus, adminRemarks, id]
    );
    await client.query("COMMIT");
    res.json(formatOrder(upd.rows[0]));
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    req.log?.error({ err }, "customer-order status update failed");
    res.status(500).json({ error: err?.message ?? "Server error" });
  } finally {
    client.release();
  }
});

export default router;
