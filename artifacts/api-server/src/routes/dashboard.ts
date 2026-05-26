import { Router, type IRouter } from "express";
import { sql, isNotNull, isNull, and, ilike, or } from "drizzle-orm";
import { pool } from "@workspace/db";
import {
  invoicesTable,
  productsTable,
  entitiesTable,
} from "@workspace/db";
import { db } from "@workspace/db";

const router: IRouter = Router();

async function queryOne(text: string, params: any[] = []): Promise<any> {
  const result = await pool.query(text, params);
  return result.rows[0] ?? {};
}

async function queryMany(text: string, params: any[] = []): Promise<any[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// GET /dashboard/summary
router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [salesRow, outstandingRow, lowStockRow, pendingRow, workloadRow, productsRow, customersRow] = await Promise.all([
    queryOne(
      `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
       FROM invoices
       WHERE EXTRACT(MONTH FROM invoice_date) = $1
         AND EXTRACT(YEAR FROM invoice_date) = $2
         AND status = 'saved'`,
      [month, year]
    ),
    queryOne(`SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM entities WHERE type = 'customer'`),
    queryOne(`SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND min_stock_threshold IS NOT NULL AND current_stock < min_stock_threshold`),
    queryOne(`SELECT COUNT(*) as count FROM payments WHERE status = 'pending'`),
    queryOne(`SELECT COUNT(*) as count FROM workload_cards WHERE status IN ('pending', 'processing')`),
    queryOne(`SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND current_stock > 0`),
    queryOne(`SELECT COUNT(*) as count FROM entities WHERE type = 'customer'`),
  ]);

  res.json({
    totalSalesThisMonth: Number(salesRow.total ?? 0),
    invoicesThisMonth: Number(salesRow.count ?? 0),
    totalOutstanding: Number(outstandingRow.total ?? 0),
    lowStockCount: Number(lowStockRow.count ?? 0),
    pendingPayments: Number(pendingRow.count ?? 0),
    activeWorkloadCards: Number(workloadRow.count ?? 0),
    totalProductsInStock: Number(productsRow.count ?? 0),
    totalCustomers: Number(customersRow.count ?? 0),
  });
});

// GET /dashboard/capital (admin only)
router.get("/dashboard/capital", async (req, res): Promise<void> => {
  const role = (req as any).session?.role;
  if (role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const [invRow, recvRow, cashRow, payRow, expRow] = await Promise.all([
    queryOne(
      `SELECT COALESCE(SUM(current_stock * purchase_price), 0) AS v
       FROM products
       WHERE deleted_at IS NULL`
    ),
    queryOne(
      `SELECT COALESCE(SUM(outstanding_balance), 0) AS v
       FROM entities
       WHERE type = 'customer' AND outstanding_balance > 0`
    ),
    queryOne(
      `SELECT COALESCE(SUM(current_balance), 0) AS v
       FROM accounts
       WHERE COALESCE(is_active, true) = true`
    ),
    queryOne(
      `SELECT COALESCE(SUM(outstanding_balance), 0) AS v
       FROM entities
       WHERE type = 'vendor' AND outstanding_balance > 0`
    ),
    queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS v FROM expenses`
    ),
  ]);

  const inventoryValue = Number(invRow.v ?? 0);
  const receivable = Number(recvRow.v ?? 0);
  const cashInAccounts = Number(cashRow.v ?? 0);
  const payable = Number(payRow.v ?? 0);
  const expenses = Number(expRow.v ?? 0);
  const capital = inventoryValue + receivable + cashInAccounts - payable - expenses;
  const capitalK = capital / 1000;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Upsert today's snapshot (so growth is computable tomorrow)
  await pool.query(
    `INSERT INTO capital_snapshots
       (snapshot_date, inventory_value, receivable, cash_in_accounts, payable, expenses, capital, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (snapshot_date) DO UPDATE SET
       inventory_value = EXCLUDED.inventory_value,
       receivable = EXCLUDED.receivable,
       cash_in_accounts = EXCLUDED.cash_in_accounts,
       payable = EXCLUDED.payable,
       expenses = EXCLUDED.expenses,
       capital = EXCLUDED.capital,
       captured_at = NOW()`,
    [todayStr, inventoryValue, receivable, cashInAccounts, payable, expenses, capital]
  );

  // Look up most recent prior snapshot (yesterday preferred, else latest before today)
  const prevRow = await queryOne(
    `SELECT snapshot_date, capital
     FROM capital_snapshots
     WHERE snapshot_date < $1
     ORDER BY snapshot_date DESC
     LIMIT 1`,
    [todayStr]
  );

  const previousCapital = prevRow?.capital != null ? Number(prevRow.capital) : null;
  const previousCapitalK = previousCapital != null ? previousCapital / 1000 : null;
  const previousDate = prevRow?.snapshot_date
    ? (prevRow.snapshot_date instanceof Date
        ? prevRow.snapshot_date.toISOString().slice(0, 10)
        : String(prevRow.snapshot_date))
    : null;
  const growth = previousCapital != null ? capital - previousCapital : null;
  const growthK = previousCapitalK != null ? capitalK - previousCapitalK : null;

  res.json({
    snapshotDate: todayStr,
    inventoryValue,
    receivable,
    cashInAccounts,
    payable,
    expenses,
    capital,
    capitalK,
    previousCapital,
    previousCapitalK,
    previousDate,
    growth,
    growthK,
  });
});

// GET /dashboard/recent-invoices
router.get("/dashboard/recent-invoices", async (_req, res): Promise<void> => {
  const rows = await queryMany(
    `SELECT id, invoice_no, invoice_date, customer_name, grand_total, status
     FROM invoices WHERE status = 'saved' ORDER BY created_at DESC LIMIT 10`
  );

  res.json(rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoice_no,
    invoiceDate: r.invoice_date ? new Date(r.invoice_date).toISOString() : null,
    customerName: r.customer_name ?? null,
    grandTotal: Number(r.grand_total),
    status: r.status,
  })));
});

// GET /dashboard/low-stock
router.get("/dashboard/low-stock", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(
      and(
        isNull(productsTable.deletedAt),
        isNotNull(productsTable.minStockThreshold),
        sql`${productsTable.currentStock} < ${productsTable.minStockThreshold}`
      )
    )
    .orderBy(productsTable.currentStock)
    .limit(20);

  res.json(products.map((p) => ({
    id: p.id,
    name: p.name,
    currentStock: Number(p.currentStock),
    minStockThreshold: Number(p.minStockThreshold),
    unit: p.unit,
  })));
});

// GET /dashboard/top-products
router.get("/dashboard/top-products", async (_req, res): Promise<void> => {
  const rows = await queryMany(
    `SELECT
       ii.product_id as "productId",
       ii.product_name as "productName",
       SUM(ii.qty) as "totalQtySold",
       SUM(ii.amount) as "totalRevenue"
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.status = 'saved'
     GROUP BY ii.product_id, ii.product_name
     ORDER BY "totalRevenue" DESC
     LIMIT 10`
  );

  res.json(rows.map((r) => ({
    productId: Number(r.productId),
    productName: r.productName,
    totalQtySold: Number(r.totalQtySold),
    totalRevenue: Number(r.totalRevenue),
  })));
});

// GET /dashboard/sales-trend
router.get("/dashboard/sales-trend", async (_req, res): Promise<void> => {
  const rows = await queryMany(
    `SELECT
       EXTRACT(MONTH FROM invoice_date)::int as month,
       EXTRACT(YEAR FROM invoice_date)::int as year,
       COALESCE(SUM(grand_total), 0) as "totalSales",
       COUNT(*) as "invoiceCount"
     FROM invoices
     WHERE status = 'saved'
       AND invoice_date >= NOW() - INTERVAL '12 months'
     GROUP BY EXTRACT(MONTH FROM invoice_date), EXTRACT(YEAR FROM invoice_date)
     ORDER BY year, month`
  );

  res.json(rows.map((r) => ({
    month: Number(r.month),
    year: Number(r.year),
    totalSales: Number(r.totalSales),
    invoiceCount: Number(r.invoiceCount),
  })));
});

// GET /reports/ledger
router.get("/reports/ledger", async (req, res): Promise<void> => {
  const { entityId, from, to } = req.query as any;

  let text = `SELECT * FROM ledger_entries WHERE 1=1`;
  const params: any[] = [];

  if (entityId) {
    params.push(Number(entityId));
    text += ` AND entity_id = $${params.length}`;
  }
  if (from) {
    params.push(new Date(from));
    text += ` AND date >= $${params.length}`;
  }
  if (to) {
    params.push(new Date(to));
    text += ` AND date <= $${params.length}`;
  }

  text += ` ORDER BY date DESC LIMIT 100`;

  const rows = await queryMany(text, params);

  res.json(rows.map((e) => ({
    id: e.id,
    date: new Date(e.date).toISOString(),
    description: e.description,
    debit: Number(e.debit),
    credit: Number(e.credit),
    balance: Number(e.balance),
    type: e.type,
    referenceId: e.reference_id ?? null,
    referenceNo: e.reference_no ?? null,
  })));
});

// GET /reports/audit-log
router.get("/reports/audit-log", async (_req, res): Promise<void> => {
  const rows = await queryMany(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100`
  );

  res.json(rows.map((e) => ({
    id: e.id,
    action: e.action,
    description: e.description ?? null,
    userId: e.user_id,
    userName: e.user_name ?? null,
    metadata: e.metadata ?? null,
    createdAt: new Date(e.created_at).toISOString(),
  })));
});

// GET /search
router.get("/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.json({ products: [], entities: [], invoices: [] });
    return;
  }

  const pattern = `%${q}%`;

  const [products, entities, invoices] = await Promise.all([
    db.select().from(productsTable).where(
      and(
        isNull(productsTable.deletedAt),
        or(ilike(productsTable.name, pattern), ilike(productsTable.itemCode, pattern))
      )
    ).limit(5),
    db.select().from(entitiesTable).where(
      or(ilike(entitiesTable.name, pattern), ilike(entitiesTable.mobile, pattern))
    ).limit(5),
    queryMany(
      `SELECT id, invoice_no, invoice_date, customer_name, grand_total, status
       FROM invoices
       WHERE invoice_no ILIKE $1 OR customer_name ILIKE $1
       ORDER BY created_at DESC LIMIT 5`,
      [pattern]
    ),
  ]);

  res.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      printName: p.printName ?? null,
      group: p.group,
      brand: p.brand,
      itemCode: p.itemCode,
      unit: p.unit,
      purchasePrice: Number(p.purchasePrice),
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      mrp: Number(p.mrp),
      minSalePrice: p.minSalePrice != null ? Number(p.minSalePrice) : null,
      currentStock: Number(p.currentStock),
      openingStock: p.openingStock != null ? Number(p.openingStock) : null,
      openingStockValue: p.openingStockValue != null ? Number(p.openingStockValue) : null,
      pricingBasis: p.pricingBasis,
      wholesaleMargin: p.wholesaleMargin != null ? Number(p.wholesaleMargin) : null,
      retailMargin: p.retailMargin != null ? Number(p.retailMargin) : null,
      hsnCode: p.hsnCode ?? null,
      taxRate: p.taxRate != null ? Number(p.taxRate) : null,
      litersPerBox: p.litersPerBox != null ? Number(p.litersPerBox) : null,
      notForSale: p.notForSale,
      addForManufacturing: p.addForManufacturing,
      minStockThreshold: p.minStockThreshold != null ? Number(p.minStockThreshold) : null,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt?.toISOString(),
    })),
    entities: entities.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      mobile: e.mobile,
      gstin: e.gstin ?? null,
      address: e.address ?? null,
      city: e.city ?? null,
      state: e.state ?? null,
      pricingTier: e.pricingTier ?? null,
      outstandingBalance: Number(e.outstandingBalance ?? 0),
      creditLimit: e.creditLimit != null ? Number(e.creditLimit) : null,
      userId: e.userId ?? null,
      createdAt: e.createdAt?.toISOString(),
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      invoiceDate: inv.invoice_date ? new Date(inv.invoice_date).toISOString() : null,
      customerName: inv.customer_name ?? null,
      grandTotal: Number(inv.grand_total),
      status: inv.status,
    })),
  });
});

export default router;
