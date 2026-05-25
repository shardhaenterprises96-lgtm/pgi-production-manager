import { Router, type IRouter } from "express";
import { and, eq, sql, desc, gte, lt, or, inArray } from "drizzle-orm";
import {
  db, pool,
  locationsTable,
  shopInventoryTable,
  shopStockMovementsTable,
  stockTransfersTable,
  stockTransferItemsTable,
  posSalesTable,
  posSaleItemsTable,
  shopPurchasesTable,
  shopPurchaseItemsTable,
  productsTable,
  stockMovementsTable,
  workloadCardsTable,
  bomsTable,
} from "@workspace/db";

const router: IRouter = Router();

type Sess = { userId: number; role: string; locationId: number | null };

/**
 * Centralized auth gate for shop routes.
 *  - Always requires a logged-in user.
 *  - If `roles` given, user.role must be one of them.
 *  - `scopeLocation`: when true, shop-role users may ONLY act on their assigned
 *    locationId; the function returns the effective locationId (overriding any
 *    spoofed query/body field). Admin/store/manufacturing bypass scope.
 */
function gate(
  req: any,
  res: any,
  opts: { roles?: string[]; scopeLocation?: boolean; requestedLocation?: number } = {},
): { ok: false } | { ok: true; sess: Sess; effectiveLocationId: number | null } {
  const s = req?.session as Sess | undefined;
  if (!s?.userId) { res.status(401).json({ error: "Not authenticated" }); return { ok: false }; }
  if (opts.roles && !opts.roles.includes(s.role)) {
    res.status(403).json({ error: "Forbidden" }); return { ok: false };
  }
  let effectiveLocationId: number | null = opts.requestedLocation ?? null;
  if (opts.scopeLocation && s.role === "shop") {
    if (!s.locationId) { res.status(403).json({ error: "Shop user has no assigned location" }); return { ok: false }; }
    if (opts.requestedLocation && opts.requestedLocation !== s.locationId) {
      res.status(403).json({ error: "Cross-location access denied" }); return { ok: false };
    }
    effectiveLocationId = s.locationId;
  }
  return { ok: true, sess: s, effectiveLocationId };
}

function posNum(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid positive number: ${v}`);
  return n;
}
function nonNegNum(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid non-negative number: ${v}`);
  return n;
}
function posInt(v: any): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid id: ${v}`);
  return n;
}

function dayRange(dateStr?: string): { start: Date; end: Date } {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// ---------------- LOCATIONS ----------------
router.get("/locations", async (req, res): Promise<void> => {
  const g = gate(req, res);
  if (!g.ok) return;
  const rows = await db.select().from(locationsTable).orderBy(locationsTable.id);
  res.json(rows);
});

// ---------------- SHOP INVENTORY ----------------
async function fetchShopInventory(locationId: number, onlyLow = false) {
  const rows = await db
    .select({
      id: shopInventoryTable.id,
      locationId: shopInventoryTable.locationId,
      productId: shopInventoryTable.productId,
      productName: productsTable.name,
      itemCode: productsTable.itemCode,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      currentStock: shopInventoryTable.currentStock,
      minStockThreshold: shopInventoryTable.minStockThreshold,
      sourceType: shopInventoryTable.sourceType,
      shopRetailPrice: shopInventoryTable.shopRetailPrice,
      factoryStock: productsTable.currentStock,
    })
    .from(shopInventoryTable)
    .innerJoin(productsTable, eq(productsTable.id, shopInventoryTable.productId))
    .where(eq(shopInventoryTable.locationId, locationId))
    .orderBy(productsTable.name);

  const productIds = rows.map((r) => r.productId);
  const bomRows = productIds.length
    ? await db.select({ pid: bomsTable.finishedProductId }).from(bomsTable).where(inArray(bomsTable.finishedProductId, productIds))
    : [];
  const bomSet = new Set(bomRows.map((b) => b.pid));

  const enriched = rows.map((r) => ({
    ...r,
    hasBom: bomSet.has(r.productId),
  }));

  if (!onlyLow) return enriched;
  return enriched.filter(
    (r) => Number(r.currentStock) <= Number(r.minStockThreshold),
  );
}

router.get("/shop/inventory", async (req, res): Promise<void> => {
  try {
    const requested = posInt(req.query.locationId);
    const g = gate(req, res, { scopeLocation: true, requestedLocation: requested });
    if (!g.ok) return;
    res.json(await fetchShopInventory(g.effectiveLocationId!));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed" }); }
});

router.get("/shop/low-stock", async (req, res): Promise<void> => {
  try {
    const requested = posInt(req.query.locationId);
    const g = gate(req, res, { scopeLocation: true, requestedLocation: requested });
    if (!g.ok) return;
    res.json(await fetchShopInventory(g.effectiveLocationId!, true));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed" }); }
});

router.post("/shop/inventory", async (req, res): Promise<void> => {
  // Only admin can add a product to a shop's catalog.
  const g = gate(req, res, { roles: ["admin"] });
  if (!g.ok) return;
  const { locationId, productId, minStockThreshold, sourceType, shopRetailPrice } = req.body ?? {};
  if (!locationId || !productId) { res.status(400).json({ error: "locationId, productId required" }); return; }
  try {
    const [row] = await db
      .insert(shopInventoryTable)
      .values({
        locationId,
        productId,
        minStockThreshold: String(minStockThreshold ?? 0),
        sourceType: sourceType ?? "factory",
        shopRetailPrice: shopRetailPrice != null ? String(shopRetailPrice) : null,
      })
      .returning();
    const list = await fetchShopInventory(locationId);
    res.status(201).json(list.find((r) => r.id === row.id) ?? row);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed" });
  }
});

router.patch("/shop/inventory/:id", async (req, res): Promise<void> => {
  const { minStockThreshold, sourceType, shopRetailPrice, currentStock } = req.body ?? {};
  // currentStock overrides are admin-only; min/source/price changes allowed for shop+admin.
  const wantsStockOverride = currentStock != null;
  const g = gate(req, res, { roles: wantsStockOverride ? ["admin"] : ["admin", "shop"] });
  if (!g.ok) return;
  const userId = g.sess.userId;
  let id: number;
  try { id = posInt(req.params.id); } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const patch: Record<string, any> = {};
  if (minStockThreshold != null) patch.minStockThreshold = String(minStockThreshold);
  if (sourceType) patch.sourceType = sourceType;
  if (shopRetailPrice !== undefined) patch.shopRetailPrice = shopRetailPrice == null ? null : String(shopRetailPrice);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM shop_inventory WHERE id = $1 FOR UPDATE", [id]);
    if (existing.rowCount === 0) { await client.query("ROLLBACK"); res.status(404).json({ error: "Not found" }); return; }
    // Shop user (when allowed to edit min/source/price) may only edit their own location.
    if (g.sess.role === "shop" && existing.rows[0].location_id !== g.sess.locationId) {
      await client.query("ROLLBACK"); res.status(403).json({ error: "Cross-location access denied" }); return;
    }
    if (wantsStockOverride) nonNegNum(currentStock);
    if (minStockThreshold != null) nonNegNum(minStockThreshold);
    if (shopRetailPrice != null) nonNegNum(shopRetailPrice);
    if (Object.keys(patch).length) {
      const sets: string[] = [];
      const vals: any[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(patch)) {
        sets.push(`${k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())} = $${i++}`);
        vals.push(v);
      }
      vals.push(id);
      await client.query(`UPDATE shop_inventory SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    }
    if (currentStock != null) {
      const cur = Number(existing.rows[0].current_stock);
      const newQty = Number(currentStock);
      const delta = newQty - cur;
      await client.query("UPDATE shop_inventory SET current_stock = $1 WHERE id = $2", [String(newQty), id]);
      await client.query(
        `INSERT INTO shop_stock_movements (location_id, product_id, type, quantity, reason, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [existing.rows[0].location_id, existing.rows[0].product_id, delta >= 0 ? "adjustment_in" : "adjustment_out",
         String(Math.abs(delta)), "Manual adjustment", userId],
      );
    }
    await client.query("COMMIT");
    const list = await fetchShopInventory(existing.rows[0].location_id);
    res.json(list.find((r) => r.id === id));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

// ---------------- STOCK TRANSFERS ----------------
async function fetchTransfers(filter: { locationId?: number; status?: string }) {
  const conds: any[] = [];
  if (filter.locationId) {
    conds.push(or(eq(stockTransfersTable.fromLocationId, filter.locationId), eq(stockTransfersTable.toLocationId, filter.locationId)));
  }
  if (filter.status) conds.push(eq(stockTransfersTable.status, filter.status));

  const transfers = await db
    .select({
      id: stockTransfersTable.id,
      transferNo: stockTransfersTable.transferNo,
      fromLocationId: stockTransfersTable.fromLocationId,
      toLocationId: stockTransfersTable.toLocationId,
      status: stockTransfersTable.status,
      notes: stockTransfersTable.notes,
      linkedWorkloadCardId: stockTransfersTable.linkedWorkloadCardId,
      createdAt: stockTransfersTable.createdAt,
      dispatchedAt: stockTransfersTable.dispatchedAt,
      receivedAt: stockTransfersTable.receivedAt,
    })
    .from(stockTransfersTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(stockTransfersTable.createdAt));

  if (transfers.length === 0) return [];
  const ids = transfers.map((t) => t.id);
  const items = await db
    .select({
      id: stockTransferItemsTable.id,
      transferId: stockTransferItemsTable.transferId,
      productId: stockTransferItemsTable.productId,
      productName: productsTable.name,
      unit: productsTable.unit,
      requestedQty: stockTransferItemsTable.requestedQty,
      dispatchedQty: stockTransferItemsTable.dispatchedQty,
      receivedQty: stockTransferItemsTable.receivedQty,
    })
    .from(stockTransferItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, stockTransferItemsTable.productId))
    .where(inArray(stockTransferItemsTable.transferId, ids));

  const locs = await db.select().from(locationsTable);
  const locMap = new Map(locs.map((l) => [l.id, l.name]));
  const itemsByTransfer = new Map<number, any[]>();
  for (const it of items) {
    const arr = itemsByTransfer.get(it.transferId) ?? [];
    arr.push(it);
    itemsByTransfer.set(it.transferId, arr);
  }
  return transfers.map((t) => ({
    ...t,
    fromLocationName: locMap.get(t.fromLocationId) ?? null,
    toLocationName: locMap.get(t.toLocationId) ?? null,
    items: itemsByTransfer.get(t.id) ?? [],
  }));
}

router.get("/shop/transfers", async (req, res): Promise<void> => {
  const g = gate(req, res);
  if (!g.ok) return;
  let locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
  // Shop users are force-scoped to their own location regardless of query.
  if (g.sess.role === "shop") {
    if (!g.sess.locationId) { res.status(403).json({ error: "Shop user has no assigned location" }); return; }
    locationId = g.sess.locationId;
  }
  const status = (req.query.status as string) || undefined;
  res.json(await fetchTransfers({ locationId, status }));
});

router.post("/shop/transfers", async (req, res): Promise<void> => {
  const g = gate(req, res, { roles: ["admin", "shop", "store"] });
  if (!g.ok) return;
  const userId = g.sess.userId;
  const { fromLocationId, toLocationId, notes, items } = req.body ?? {};
  if (!fromLocationId || !toLocationId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "fromLocationId, toLocationId, items required" }); return;
  }
  // Shop users may only request INTO their own location.
  if (g.sess.role === "shop" && Number(toLocationId) !== g.sess.locationId) {
    res.status(403).json({ error: "Shop users can only receive into their own location" }); return;
  }
  try {
    for (const it of items) { posInt(it.productId); posNum(it.requestedQty); }
  } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transferNo = `TR-${Date.now()}`;

    // Check if any factory-sourced item has a BOM → create one workload card per such product
    let firstWorkloadCardId: number | null = null;
    for (const it of items) {
      const inv = await client.query(
        `SELECT source_type FROM shop_inventory WHERE location_id = $1 AND product_id = $2`,
        [toLocationId, it.productId],
      );
      const isFactory = inv.rowCount === 0 || inv.rows[0].source_type === "factory";
      if (!isFactory) continue;
      const bom = await client.query(`SELECT id FROM boms WHERE finished_product_id = $1 LIMIT 1`, [it.productId]);
      if (bom.rowCount === 0) continue;
      const factoryStock = await client.query(`SELECT current_stock FROM products WHERE id = $1`, [it.productId]);
      const shortage = Number(it.requestedQty) - Number(factoryStock.rows[0]?.current_stock ?? 0);
      if (shortage <= 0) continue;
      const wc = await client.query(
        `INSERT INTO workload_cards (product_id, target_qty, status, order_type, reference_order_id)
         VALUES ($1, $2, 'pending', 'low_stock_alert', NULL) RETURNING id`,
        [it.productId, String(shortage)],
      );
      if (firstWorkloadCardId === null) firstWorkloadCardId = wc.rows[0].id;
    }

    const tr = await client.query(
      `INSERT INTO stock_transfers (transfer_no, from_location_id, to_location_id, status, notes, linked_workload_card_id, created_by)
       VALUES ($1, $2, $3, 'requested', $4, $5, $6) RETURNING id`,
      [transferNo, fromLocationId, toLocationId, notes ?? null, firstWorkloadCardId, userId],
    );
    const transferId = tr.rows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO stock_transfer_items (transfer_id, product_id, requested_qty) VALUES ($1, $2, $3)`,
        [transferId, it.productId, String(it.requestedQty)],
      );
    }
    await client.query("COMMIT");
    const list = await fetchTransfers({});
    res.status(201).json(list.find((t) => t.id === transferId));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

router.post("/shop/transfers/:id/dispatch", async (req, res): Promise<void> => {
  const g = gate(req, res, { roles: ["admin", "store", "manufacturing"] });
  if (!g.ok) return;
  const userId = g.sess.userId;
  let id: number;
  try { id = posInt(req.params.id); } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const tr = await client.query("SELECT * FROM stock_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (tr.rowCount === 0) throw new Error("Transfer not found");
    if (tr.rows[0].status !== "requested") throw new Error("Only requested transfers can be dispatched");

    const items = await client.query("SELECT * FROM stock_transfer_items WHERE transfer_id = $1", [id]);
    for (const it of items.rows) {
      const stock = await client.query("SELECT current_stock FROM products WHERE id = $1 FOR UPDATE", [it.product_id]);
      const cur = Number(stock.rows[0].current_stock);
      const need = Number(it.requested_qty);
      if (cur < need) throw new Error(`Insufficient factory stock for product ${it.product_id}: have ${cur}, need ${need}`);
      await client.query("UPDATE products SET current_stock = current_stock - $1 WHERE id = $2", [String(need), it.product_id]);
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, reference_id, reference_type, user_id)
         VALUES ($1, 'transfer_out', $2, $3, $4, 'stock_transfer', $5)`,
        [it.product_id, String(need), `Dispatched on transfer ${tr.rows[0].transfer_no}`, id, userId],
      );
      await client.query("UPDATE stock_transfer_items SET dispatched_qty = $1 WHERE id = $2", [String(need), it.id]);
    }
    await client.query(`UPDATE stock_transfers SET status = 'dispatched', dispatched_at = NOW() WHERE id = $1`, [id]);
    await client.query("COMMIT");
    const list = await fetchTransfers({});
    res.json(list.find((t) => t.id === id));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

router.post("/shop/transfers/:id/receive", async (req, res): Promise<void> => {
  const g = gate(req, res, { roles: ["admin", "shop"] });
  if (!g.ok) return;
  const userId = g.sess.userId;
  let id: number;
  try { id = posInt(req.params.id); } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const tr = await client.query("SELECT * FROM stock_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (tr.rowCount === 0) throw new Error("Transfer not found");
    if (tr.rows[0].status !== "dispatched") throw new Error("Only dispatched transfers can be received");
    if (g.sess.role === "shop" && tr.rows[0].to_location_id !== g.sess.locationId) {
      throw Object.assign(new Error("Cross-location receive denied"), { status: 403 });
    }

    const items = await client.query("SELECT * FROM stock_transfer_items WHERE transfer_id = $1", [id]);
    for (const it of items.rows) {
      const qty = it.dispatched_qty;
      // ensure row exists in shop_inventory
      const inv = await client.query(
        `SELECT id FROM shop_inventory WHERE location_id = $1 AND product_id = $2`,
        [tr.rows[0].to_location_id, it.product_id],
      );
      if (inv.rowCount === 0) {
        await client.query(
          `INSERT INTO shop_inventory (location_id, product_id, current_stock, source_type)
           VALUES ($1, $2, $3, 'factory')`,
          [tr.rows[0].to_location_id, it.product_id, String(qty)],
        );
      } else {
        await client.query(
          `UPDATE shop_inventory SET current_stock = current_stock + $1 WHERE id = $2`,
          [String(qty), inv.rows[0].id],
        );
      }
      await client.query(
        `INSERT INTO shop_stock_movements (location_id, product_id, type, quantity, reason, reference_id, reference_type, user_id)
         VALUES ($1, $2, 'transfer_in', $3, $4, $5, 'stock_transfer', $6)`,
        [tr.rows[0].to_location_id, it.product_id, String(qty),
         `Received on transfer ${tr.rows[0].transfer_no}`, id, userId],
      );
      await client.query("UPDATE stock_transfer_items SET received_qty = $1 WHERE id = $2", [String(qty), it.id]);
    }
    await client.query(`UPDATE stock_transfers SET status = 'received', received_at = NOW() WHERE id = $1`, [id]);
    await client.query("COMMIT");
    const list = await fetchTransfers({});
    res.json(list.find((t) => t.id === id));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

// ---------------- POS SALES ----------------
async function fetchPosSales(locationId: number, date?: string) {
  const { start, end } = dayRange(date);
  const sales = await db
    .select()
    .from(posSalesTable)
    .where(and(eq(posSalesTable.locationId, locationId), gte(posSalesTable.createdAt, start), lt(posSalesTable.createdAt, end)))
    .orderBy(desc(posSalesTable.createdAt));
  if (sales.length === 0) return [];
  const ids = sales.map((s) => s.id);
  const items = await db.select().from(posSaleItemsTable).where(inArray(posSaleItemsTable.saleId, ids));
  const byId = new Map<number, any[]>();
  for (const it of items) {
    const arr = byId.get(it.saleId) ?? [];
    arr.push(it);
    byId.set(it.saleId, arr);
  }
  return sales.map((s) => ({ ...s, items: byId.get(s.id) ?? [] }));
}

router.get("/shop/pos/sales", async (req, res): Promise<void> => {
  try {
    const requested = posInt(req.query.locationId);
    const g = gate(req, res, { roles: ["admin", "shop", "accountant"], scopeLocation: true, requestedLocation: requested });
    if (!g.ok) return;
    res.json(await fetchPosSales(g.effectiveLocationId!, req.query.date as string | undefined));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed" }); }
});

router.post("/shop/pos/sales", async (req, res): Promise<void> => {
  const { locationId, customerName, customerMobile, paymentMode, discount, items } = req.body ?? {};
  if (!locationId || !paymentMode || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "locationId, paymentMode, items required" }); return;
  }
  if (!["cash", "upi", "card", "credit"].includes(paymentMode)) {
    res.status(400).json({ error: "Invalid paymentMode" }); return;
  }
  let requested: number;
  try {
    requested = posInt(locationId);
    for (const it of items) { posInt(it.productId); posNum(it.qty); nonNegNum(it.rate); }
    if (discount != null) nonNegNum(discount);
  } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const g = gate(req, res, { roles: ["admin", "shop"], scopeLocation: true, requestedLocation: requested });
  if (!g.ok) return;
  const userId = g.sess.userId;
  const effectiveLocationId = g.effectiveLocationId!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    let subtotal = 0;
    const enriched: any[] = [];
    for (const it of items) {
      const inv = await client.query(
        `SELECT si.id AS inv_id, si.current_stock, p.name FROM shop_inventory si
         INNER JOIN products p ON p.id = si.product_id
         WHERE si.location_id = $1 AND si.product_id = $2 FOR UPDATE`,
        [effectiveLocationId, it.productId],
      );
      if (inv.rowCount === 0) throw new Error(`Product ${it.productId} not in shop inventory`);
      const cur = Number(inv.rows[0].current_stock);
      const qty = Number(it.qty);
      if (cur < qty) throw new Error(`Insufficient stock for ${inv.rows[0].name}: have ${cur}, need ${qty}`);
      const rate = Number(it.rate);
      const amount = +(qty * rate).toFixed(2);
      subtotal += amount;
      enriched.push({ productId: it.productId, productName: inv.rows[0].name, qty, rate, amount, invId: inv.rows[0].inv_id });
    }
    const disc = Number(discount ?? 0);
    const total = +(subtotal - disc).toFixed(2);
    if (total < 0) throw new Error("Discount cannot exceed subtotal");

    // Use MAX(id)+1 instead of COUNT(*) so deletions don't cause collisions; the
    // SERIALIZABLE isolation + retry-on-conflict prevents duplicates.
    const billRow = await client.query(
      `SELECT COALESCE(MAX((regexp_replace(bill_no, '.*-', ''))::int), 0) + 1 AS n
       FROM pos_sales WHERE location_id = $1`,
      [effectiveLocationId],
    );
    const billNo = `POS-${effectiveLocationId}-${String(billRow.rows[0].n).padStart(5, "0")}`;

    const sale = await client.query(
      `INSERT INTO pos_sales (location_id, bill_no, customer_name, customer_mobile, payment_mode, subtotal, discount, total, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [effectiveLocationId, billNo, customerName ?? null, customerMobile ?? null, paymentMode, String(subtotal), String(disc), String(total), userId],
    );
    const saleId = sale.rows[0].id;
    for (const it of enriched) {
      await client.query(
        `INSERT INTO pos_sale_items (sale_id, product_id, product_name, qty, rate, amount)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [saleId, it.productId, it.productName, String(it.qty), String(it.rate), String(it.amount)],
      );
      await client.query(`UPDATE shop_inventory SET current_stock = current_stock - $1 WHERE id = $2`, [String(it.qty), it.invId]);
      await client.query(
        `INSERT INTO shop_stock_movements (location_id, product_id, type, quantity, reason, reference_id, reference_type, user_id)
         VALUES ($1,$2,'pos_sale',$3,$4,$5,'pos_sale',$6)`,
        [effectiveLocationId, it.productId, String(it.qty), `POS bill ${billNo}`, saleId, userId],
      );
    }
    await client.query("COMMIT");
    const list = await fetchPosSales(effectiveLocationId);
    res.status(201).json(list.find((s) => s.id === saleId));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

router.get("/shop/pos/summary", async (req, res): Promise<void> => {
  let requested: number;
  try { requested = posInt(req.query.locationId); } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const g = gate(req, res, { roles: ["admin", "shop", "accountant"], scopeLocation: true, requestedLocation: requested });
  if (!g.ok) return;
  const locationId = g.effectiveLocationId!;
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(date);
  const rows = await db
    .select({
      mode: posSalesTable.paymentMode,
      total: sql<string>`COALESCE(SUM(${posSalesTable.total}),0)::text`,
      count: sql<number>`COUNT(*)::int`,
      subtotalSum: sql<string>`COALESCE(SUM(${posSalesTable.subtotal}),0)::text`,
      discountSum: sql<string>`COALESCE(SUM(${posSalesTable.discount}),0)::text`,
    })
    .from(posSalesTable)
    .where(and(eq(posSalesTable.locationId, locationId), gte(posSalesTable.createdAt, start), lt(posSalesTable.createdAt, end)))
    .groupBy(posSalesTable.paymentMode);

  let totalSales = 0, totalDiscount = 0, totalNet = 0, billCount = 0;
  const byPaymentMode = rows.map((r) => {
    totalSales += Number(r.subtotalSum);
    totalDiscount += Number(r.discountSum);
    totalNet += Number(r.total);
    billCount += r.count;
    return { mode: r.mode, total: r.total, count: r.count };
  });

  res.json({
    locationId,
    date,
    totalSales: totalSales.toFixed(2),
    totalDiscount: totalDiscount.toFixed(2),
    totalNet: totalNet.toFixed(2),
    billCount,
    byPaymentMode,
  });
});

// ---------------- SHOP PURCHASES ----------------
async function fetchShopPurchases(locationId: number) {
  const purchases = await db
    .select()
    .from(shopPurchasesTable)
    .where(eq(shopPurchasesTable.locationId, locationId))
    .orderBy(desc(shopPurchasesTable.createdAt));
  if (purchases.length === 0) return [];
  const ids = purchases.map((p) => p.id);
  const items = await db.select().from(shopPurchaseItemsTable).where(inArray(shopPurchaseItemsTable.purchaseId, ids));
  const byId = new Map<number, any[]>();
  for (const it of items) {
    const arr = byId.get(it.purchaseId) ?? [];
    arr.push(it);
    byId.set(it.purchaseId, arr);
  }
  return purchases.map((p) => ({ ...p, items: byId.get(p.id) ?? [] }));
}

router.get("/shop/purchases", async (req, res): Promise<void> => {
  try {
    const requested = posInt(req.query.locationId);
    const g = gate(req, res, { roles: ["admin", "shop", "accountant"], scopeLocation: true, requestedLocation: requested });
    if (!g.ok) return;
    res.json(await fetchShopPurchases(g.effectiveLocationId!));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed" }); }
});

router.post("/shop/purchases", async (req, res): Promise<void> => {
  const { locationId, billNo, vendorName, notes, items } = req.body ?? {};
  if (!locationId || !vendorName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "locationId, vendorName, items required" }); return;
  }
  let requested: number;
  try {
    requested = posInt(locationId);
    for (const it of items) { posInt(it.productId); posNum(it.qty); nonNegNum(it.rate); }
  } catch (e: any) { res.status(400).json({ error: e.message }); return; }
  const g = gate(req, res, { roles: ["admin", "shop"], scopeLocation: true, requestedLocation: requested });
  if (!g.ok) return;
  const userId = g.sess.userId;
  const effectiveLocationId = g.effectiveLocationId!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    let total = 0;
    const enriched: any[] = [];
    for (const it of items) {
      const p = await client.query(`SELECT id, name FROM products WHERE id = $1`, [it.productId]);
      if (p.rowCount === 0) throw new Error(`Product ${it.productId} not found`);
      const qty = Number(it.qty);
      const rate = Number(it.rate);
      const amount = +(qty * rate).toFixed(2);
      total += amount;
      enriched.push({ productId: it.productId, productName: p.rows[0].name, qty, rate, amount });
    }
    const pr = await client.query(
      `INSERT INTO shop_purchases (location_id, bill_no, vendor_name, total_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [effectiveLocationId, billNo ?? null, vendorName, String(total), notes ?? null, userId],
    );
    const purchaseId = pr.rows[0].id;
    for (const it of enriched) {
      await client.query(
        `INSERT INTO shop_purchase_items (purchase_id, product_id, qty, rate, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [purchaseId, it.productId, String(it.qty), String(it.rate), String(it.amount)],
      );
      // upsert shop_inventory with sourceType=self (don't override if already factory)
      const inv = await client.query(`SELECT id FROM shop_inventory WHERE location_id = $1 AND product_id = $2`, [effectiveLocationId, it.productId]);
      if (inv.rowCount === 0) {
        await client.query(
          `INSERT INTO shop_inventory (location_id, product_id, current_stock, source_type) VALUES ($1,$2,$3,'self')`,
          [effectiveLocationId, it.productId, String(it.qty)],
        );
      } else {
        await client.query(`UPDATE shop_inventory SET current_stock = current_stock + $1 WHERE id = $2`, [String(it.qty), inv.rows[0].id]);
      }
      await client.query(
        `INSERT INTO shop_stock_movements (location_id, product_id, type, quantity, reason, reference_id, reference_type, user_id)
         VALUES ($1,$2,'purchase_in',$3,$4,$5,'shop_purchase',$6)`,
        [effectiveLocationId, it.productId, String(it.qty), `Shop purchase from ${vendorName}`, purchaseId, userId],
      );
    }
    await client.query("COMMIT");
    const list = await fetchShopPurchases(effectiveLocationId);
    res.status(201).json(list.find((p) => p.id === purchaseId));
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err?.message ?? "Failed" });
  } finally {
    client.release();
  }
});

export default router;
// unused imports kept to satisfy potential future use
void stockMovementsTable; void workloadCardsTable;
