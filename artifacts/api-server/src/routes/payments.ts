import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  paymentsTable,
  entitiesTable,
  ledgerEntriesTable,
} from "@workspace/db";
import {
  ListPaymentsQueryParams,
  LogPaymentBody,
  ApprovePaymentParams,
  RejectPaymentParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /payments
router.get("/payments", async (req, res): Promise<void> => {
  const params = ListPaymentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: any[] = [];
  if (params.data.customerId) conditions.push(eq(paymentsTable.customerId, params.data.customerId));
  if (params.data.status) conditions.push(eq(paymentsTable.status, params.data.status));

  const payments = conditions.length > 0
    ? await db.select().from(paymentsTable).where(and(...conditions)).orderBy(sql`${paymentsTable.createdAt} DESC`)
    : await db.select().from(paymentsTable).orderBy(sql`${paymentsTable.createdAt} DESC`);

  res.json(payments.map(formatPayment));
});

// POST /payments
router.post("/payments", async (req, res): Promise<void> => {
  const parsed = LogPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  const isAdmin = session?.role === "admin";
  const status = isAdmin ? "approved" : "pending";

  const [customer] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, parsed.data.customerId));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const receiptId = `RCP-${Date.now()}`;

  if (isAdmin) {
    // Direct commit with SERIALIZABLE transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

      const [payment] = await db.insert(paymentsTable).values({
        receiptId,
        customerId: parsed.data.customerId,
        customerName: customer.name,
        salesmanId: null,
        salesmanName: null,
        amount: String(parsed.data.amount),
        mode: parsed.data.mode,
        status: "approved",
        notes: parsed.data.notes ?? null,
        approvedById: session.userId,
        approvedAt: new Date(),
      }).returning();

      // Deduct from outstanding
      await client.query(
        `UPDATE entities SET outstanding_balance = outstanding_balance - $1 WHERE id = $2`,
        [parsed.data.amount, parsed.data.customerId]
      );

      const balResult = await client.query(
        `SELECT outstanding_balance FROM entities WHERE id = $1`,
        [parsed.data.customerId]
      );
      const newBal = balResult.rows[0].outstanding_balance;

      await client.query(
        `INSERT INTO ledger_entries (entity_id, date, description, debit, credit, balance, type, reference_id, reference_no)
         VALUES ($1, NOW(), $2, 0, $3, $4, 'payment', $5, $6)`,
        [parsed.data.customerId, `Payment received (${parsed.data.mode})`, parsed.data.amount, newBal, payment.id, receiptId]
      );

      await client.query("COMMIT");
      res.status(201).json(formatPayment(payment));
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, "Failed to process payment");
      res.status(500).json({ error: "Failed to process payment" });
    } finally {
      client.release();
    }
  } else {
    // Salesman entry - goes to escrow (pending)
    const [payment] = await db.insert(paymentsTable).values({
      receiptId,
      customerId: parsed.data.customerId,
      customerName: customer.name,
      salesmanId: session?.userId ?? null,
      salesmanName: session?.name ?? null,
      amount: String(parsed.data.amount),
      mode: parsed.data.mode,
      status: "pending",
      notes: parsed.data.notes ?? null,
    }).returning();

    res.status(201).json(formatPayment(payment));
  }
});

// POST /payments/:id/approve
router.post("/payments/:id/approve", async (req, res): Promise<void> => {
  const params = ApprovePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = (req as any).session;
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id));

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  if (payment.status !== "pending") {
    res.status(400).json({ error: "Payment is not pending" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const [updated] = await db.update(paymentsTable)
      .set({ status: "approved", approvedById: session?.userId, approvedAt: new Date() })
      .where(eq(paymentsTable.id, params.data.id))
      .returning();

    // Deduct from outstanding
    await client.query(
      `UPDATE entities SET outstanding_balance = outstanding_balance - $1 WHERE id = $2`,
      [payment.amount, payment.customerId]
    );

    const balResult = await client.query(
      `SELECT outstanding_balance FROM entities WHERE id = $1`,
      [payment.customerId]
    );
    const newBal = balResult.rows[0].outstanding_balance;

    await client.query(
      `INSERT INTO ledger_entries (entity_id, date, description, debit, credit, balance, type, reference_id, reference_no)
       VALUES ($1, NOW(), $2, 0, $3, $4, 'payment', $5, $6)`,
      [payment.customerId, `Payment received - Approved (${payment.mode})`, payment.amount, newBal, payment.id, payment.receiptId]
    );

    await client.query("COMMIT");
    res.json(formatPayment(updated));
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Failed to approve payment");
    res.status(500).json({ error: "Failed to approve payment" });
  } finally {
    client.release();
  }
});

// POST /payments/:id/reject
router.post("/payments/:id/reject", async (req, res): Promise<void> => {
  const params = RejectPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db.update(paymentsTable)
    .set({ status: "rejected" })
    .where(eq(paymentsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  res.json(formatPayment(updated));
});

function formatPayment(p: any) {
  return {
    id: p.id,
    receiptId: p.receiptId,
    customerId: p.customerId,
    customerName: p.customerName ?? null,
    salesmanId: p.salesmanId ?? null,
    salesmanName: p.salesmanName ?? null,
    amount: Number(p.amount),
    mode: p.mode,
    status: p.status,
    notes: p.notes ?? null,
    createdAt: p.createdAt?.toISOString(),
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
  };
}

export default router;
