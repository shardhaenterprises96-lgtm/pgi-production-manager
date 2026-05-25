import { Router, type IRouter } from "express";
import { eq, and, ilike, sql, or } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  invoiceSequenceTable,
  entitiesTable,
  ledgerEntriesTable,
  stockMovementsTable,
  productsTable,
  rewardSchemesTable,
  rewardProgressTable,
} from "@workspace/db";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function generateInvoiceNumber(client: any): Promise<string> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // SERIALIZABLE ensures no race conditions
  const result = await client.query(
    `INSERT INTO invoice_sequence (month, year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT DO NOTHING
     RETURNING last_number`,
    [month, year]
  );

  let seqNum: number;
  if (result.rows.length > 0) {
    seqNum = result.rows[0].last_number;
  } else {
    const upd = await client.query(
      `UPDATE invoice_sequence SET last_number = last_number + 1 WHERE month = $1 AND year = $2 RETURNING last_number`,
      [month, year]
    );
    seqNum = upd.rows[0].last_number;
  }

  const monthStr = String(month).padStart(2, "0");
  return `INV/${monthStr}/${seqNum}`;
}

// GET /invoices
router.get("/invoices", async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: any[] = [];
  if (params.data.customerId) conditions.push(eq(invoicesTable.customerId, params.data.customerId));
  if (params.data.salesmanId) conditions.push(eq(invoicesTable.salesmanId, params.data.salesmanId));
  if (params.data.type) conditions.push(eq(invoicesTable.invoiceType, params.data.type));
  if (params.data.search) {
    conditions.push(
      or(
        ilike(invoicesTable.invoiceNo, `%${params.data.search}%`),
        ilike(invoicesTable.customerName ?? sql`''`, `%${params.data.search}%`)
      )
    );
  }
  if (params.data.month && params.data.year) {
    conditions.push(
      sql`EXTRACT(MONTH FROM ${invoicesTable.invoiceDate}) = ${params.data.month} AND EXTRACT(YEAR FROM ${invoicesTable.invoiceDate}) = ${params.data.year}`
    );
  }

  const invoices = conditions.length > 0
    ? await db.select().from(invoicesTable).where(and(...conditions)).orderBy(sql`${invoicesTable.createdAt} DESC`)
    : await db.select().from(invoicesTable).orderBy(sql`${invoicesTable.createdAt} DESC`);

  res.json(invoices.map((inv) => formatInvoice(inv, [])));
});

// POST /invoices
router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // Generate invoice number
    const invoiceNo = await generateInvoiceNumber(client);

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isInterstate = data.placeOfSupply !== "Maharashtra";
    const isGst = data.invoiceType === "gst";

    const processedItems = data.items.map((item) => {
      const qty = Number(item.qty);
      const rate = Number(item.rate);
      const discPct = Number(item.discountPct ?? 0);
      const discAmt = Number(item.discountAmt ?? 0);
      const taxPct = isGst ? Number(item.taxPct ?? 0) : 0;
      const cessPct = Number(item.cessPct ?? 0);

      const baseAmt = qty * rate;
      const effectiveDisc = discAmt > 0 ? discAmt : (baseAmt * discPct / 100);
      const taxableAmt = baseAmt - effectiveDisc;
      const taxAmt = taxableAmt * taxPct / 100;
      const cessAmt = taxableAmt * cessPct / 100;
      const amount = taxableAmt + taxAmt + cessAmt;

      subtotal += taxableAmt;
      totalDiscount += effectiveDisc;
      totalTax += taxAmt;

      if (isGst) {
        if (isInterstate) {
          igst += taxAmt;
        } else {
          cgst += taxAmt / 2;
          sgst += taxAmt / 2;
        }
      }

      return {
        ...item,
        qty: String(qty),
        qtyBoxes: item.qtyBoxes != null ? String(item.qtyBoxes) : null,
        totalLiters: item.qtyBoxes != null && item.litersPerBox != null
          ? String(Number(item.qtyBoxes) * Number(item.litersPerBox))
          : null,
        rate: String(rate),
        mrp: String(item.mrp),
        discountPct: String(discPct),
        discountAmt: String(effectiveDisc),
        taxPct: String(taxPct),
        cessPct: String(cessPct),
        netPrice: String(rate - rate * discPct / 100),
        amount: String(amount),
      };
    });

    const freight = Number(data.freight ?? 0);
    const roundOff = Number(data.roundOff ?? 0);
    const grandTotal = subtotal + totalTax + freight + roundOff;
    const balanceDue = grandTotal;

    // Get salesman name
    let salesmanName: string | null = null;
    if (data.salesmanId) {
      const [salesman] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, data.salesmanId));
      salesmanName = salesman?.name ?? null;
    } else if (session?.role === "salesman") {
      salesmanName = session.name;
    }

    // Insert invoice
    const [invoice] = await client.query(
      `INSERT INTO invoices (invoice_no, invoice_date, due_date, invoice_type, customer_id, customer_name,
        customer_gstin, billing_address, shipping_address, place_of_supply, salesman_id, salesman_name,
        po_number, e_way_bill_no, subtotal, total_discount, total_tax, cgst, sgst, igst, freight,
        round_off, grand_total, balance_due, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        invoiceNo,
        data.invoiceDate,
        data.dueDate ?? null,
        data.invoiceType,
        data.customerId ?? null,
        data.customerName ?? null,
        data.customerGstin ?? null,
        data.billingAddress ?? null,
        data.shippingAddress ?? null,
        data.placeOfSupply,
        data.salesmanId ?? (session?.role === "salesman" ? session.entityId : null) ?? null,
        salesmanName,
        data.poNumber ?? null,
        data.eWayBillNo ?? null,
        String(subtotal),
        String(totalDiscount),
        String(totalTax),
        String(cgst),
        String(sgst),
        String(igst),
        String(freight),
        String(roundOff),
        String(grandTotal),
        String(balanceDue),
        "saved",
        session?.userId ?? 1,
      ]
    );
    const invRow = invoice.rows[0];

    // Insert items + deduct stock
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, product_name, hsn_code, qty, qty_boxes, total_liters, unit, rate, mrp, discount_pct, discount_amt, tax_pct, cess_pct, net_price, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          invRow.id,
          item.productId,
          (await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, item.productId)))[0]?.name ?? "Unknown",
          null,
          item.qty,
          item.qtyBoxes,
          item.totalLiters,
          item.unit,
          item.rate,
          item.mrp,
          item.discountPct,
          item.discountAmt,
          item.taxPct,
          item.cessPct,
          item.netPrice,
          item.amount,
        ]
      );

      // Stock movement (always via stock_movements)
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, reference_id, reference_type, user_id)
         VALUES ($1, 'outward', $2, 'Invoice sale', $3, 'invoice', $4)`,
        [item.productId, item.qty, invRow.id, session?.userId ?? 1]
      );

      // Reduce product stock
      await client.query(
        `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`,
        [item.qty, item.productId]
      );
    }

    // Update customer outstanding balance & ledger
    if (data.customerId) {
      await client.query(
        `UPDATE entities SET outstanding_balance = outstanding_balance + $1 WHERE id = $2`,
        [grandTotal, data.customerId]
      );

      const balResult = await client.query(
        `SELECT outstanding_balance FROM entities WHERE id = $1`,
        [data.customerId]
      );
      const newBal = balResult.rows[0].outstanding_balance;

      await client.query(
        `INSERT INTO ledger_entries (entity_id, date, description, debit, credit, balance, type, reference_id, reference_no)
         VALUES ($1, NOW(), $2, $3, 0, $4, 'invoice', $5, $6)`,
        [data.customerId, `Invoice ${invoiceNo}`, grandTotal, newBal, invRow.id, invoiceNo]
      );
    }

    await client.query("COMMIT");

    // Fetch with items
    const [fullInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invRow.id));
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invRow.id));

    res.status(201).json(formatInvoice(fullInv, items));
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Failed to create invoice");
    res.status(500).json({ error: "Failed to create invoice" });
  } finally {
    client.release();
  }
});

// GET /invoices/:id
router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, params.data.id));
  res.json(formatInvoice(inv, items));
});

// PATCH /invoices/:id
router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inv] = await db
    .update(invoicesTable)
    .set(parsed.data)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
  res.json(formatInvoice(inv, items));
});

// DELETE /invoices/:id
router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = (req as any).session;
  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
    if (!inv) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // Mark as cancelled (do NOT reverse stock for non-GST per spec)
    await client.query(
      `UPDATE invoices SET status = 'cancelled' WHERE id = $1`,
      [params.data.id]
    );

    // For GST invoices, reverse the stock
    if (inv.invoiceType === "gst") {
      const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, params.data.id));
      for (const item of items) {
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reason, reference_id, reference_type, user_id)
           VALUES ($1, 'inward', $2, 'Invoice cancelled', $3, 'invoice_cancel', $4)`,
          [item.productId, item.qty, params.data.id, session?.userId ?? 1]
        );
        await client.query(
          `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
          [item.qty, item.productId]
        );
      }
    }

    // Audit log for non-GST deletion per spec
    if (inv.invoiceType === "non_gst") {
      await client.query(
        `INSERT INTO audit_log (action, description, user_id, user_name, metadata)
         VALUES ('non_gst_invoice_cancelled', $1, $2, $3, $4)`,
        [
          `Non-GST invoice ${inv.invoiceNo} cancelled - stock NOT reversed per policy`,
          session?.userId ?? 1,
          session?.name ?? "Unknown",
          JSON.stringify({ invoiceId: params.data.id, invoiceNo: inv.invoiceNo }),
        ]
      );
    }

    await client.query("COMMIT");
    res.sendStatus(204);
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Failed to delete invoice");
    res.status(500).json({ error: "Failed to delete invoice" });
  } finally {
    client.release();
  }
});

function formatInvoice(inv: any, items: any[]) {
  return {
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    invoiceDate: inv.invoiceDate?.toISOString?.() ?? inv.invoiceDate,
    dueDate: inv.dueDate ? (inv.dueDate?.toISOString?.() ?? inv.dueDate) : null,
    invoiceType: inv.invoiceType,
    customerId: inv.customerId ?? null,
    customerName: inv.customerName ?? null,
    customerGstin: inv.customerGstin ?? null,
    billingAddress: inv.billingAddress ?? null,
    shippingAddress: inv.shippingAddress ?? null,
    placeOfSupply: inv.placeOfSupply,
    salesmanId: inv.salesmanId ?? null,
    salesmanName: inv.salesmanName ?? null,
    poNumber: inv.poNumber ?? null,
    eWayBillNo: inv.eWayBillNo ?? null,
    subtotal: Number(inv.subtotal),
    totalDiscount: Number(inv.totalDiscount),
    totalTax: Number(inv.totalTax),
    cgst: Number(inv.cgst),
    sgst: Number(inv.sgst),
    igst: Number(inv.igst),
    freight: Number(inv.freight),
    roundOff: Number(inv.roundOff),
    grandTotal: Number(inv.grandTotal),
    amountPaid: Number(inv.amountPaid),
    balanceDue: Number(inv.balanceDue),
    status: inv.status,
    items: items.map(formatItem),
    createdAt: inv.createdAt?.toISOString?.() ?? inv.createdAt,
  };
}

function formatItem(i: any) {
  return {
    id: i.id,
    invoiceId: i.invoiceId,
    productId: i.productId,
    productName: i.productName,
    hsnCode: i.hsnCode ?? null,
    qty: Number(i.qty),
    qtyBoxes: i.qtyBoxes != null ? Number(i.qtyBoxes) : null,
    totalLiters: i.totalLiters != null ? Number(i.totalLiters) : null,
    unit: i.unit,
    rate: Number(i.rate),
    mrp: Number(i.mrp),
    discountPct: Number(i.discountPct),
    discountAmt: Number(i.discountAmt),
    taxPct: Number(i.taxPct),
    cessPct: Number(i.cessPct),
    netPrice: Number(i.netPrice),
    amount: Number(i.amount),
  };
}

export default router;
