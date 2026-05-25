import { Router, type IRouter } from "express";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { accountsTable, paymentsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  UpdateAccountParams,
  DeleteAccountParams,
  CollectCashFromSalesmanBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All accounts/cashbook routes require admin or accountant role (financial data)
const FINANCIAL_ROLES = new Set(["admin", "accountant"]);
const WRITE_ROLES = new Set(["admin"]);

function requireFinancialRead(req: any, res: any): boolean {
  const role = (req as any).session?.role;
  if (!role || !FINANCIAL_ROLES.has(role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function requireFinancialWrite(req: any, res: any): boolean {
  const role = (req as any).session?.role;
  if (!role || !WRITE_ROLES.has(role)) {
    res.status(403).json({ error: "Forbidden — admin only" });
    return false;
  }
  return true;
}

function formatAccount(a: any) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    identifier: a.identifier ?? null,
    openingBalance: Number(a.openingBalance ?? a.opening_balance ?? 0),
    currentBalance: Number(a.currentBalance ?? a.current_balance ?? 0),
    isActive: a.isActive ?? a.is_active ?? true,
    notes: a.notes ?? null,
    createdAt: (a.createdAt ?? a.created_at)?.toISOString
      ? (a.createdAt ?? a.created_at).toISOString()
      : (a.createdAt ?? a.created_at),
  };
}

// GET /accounts
router.get("/accounts", async (req, res): Promise<void> => {
  if (!requireFinancialRead(req, res)) return;
  const rows = await db
    .select()
    .from(accountsTable)
    .orderBy(sql`${accountsTable.isActive} DESC, ${accountsTable.type}, ${accountsTable.name}`);
  res.json(rows.map(formatAccount));
});

// POST /accounts
router.post("/accounts", async (req, res): Promise<void> => {
  if (!requireFinancialWrite(req, res)) return;
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const opening = parsed.data.openingBalance ?? 0;
  const [created] = await db
    .insert(accountsTable)
    .values({
      name: parsed.data.name,
      type: parsed.data.type,
      identifier: parsed.data.identifier ?? null,
      openingBalance: String(opening),
      currentBalance: String(opening),
      isActive: parsed.data.isActive ?? true,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(formatAccount(created));
});

// PUT /accounts/:id
router.put("/accounts/:id", async (req, res): Promise<void> => {
  if (!requireFinancialWrite(req, res)) return;
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(accountsTable).where(eq(accountsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  // If opening balance changed, shift current balance by the delta
  const newOpening = parsed.data.openingBalance ?? Number(existing.openingBalance);
  const delta = newOpening - Number(existing.openingBalance);
  const newCurrent = Number(existing.currentBalance) + delta;

  const [updated] = await db
    .update(accountsTable)
    .set({
      name: parsed.data.name,
      type: parsed.data.type,
      identifier: parsed.data.identifier ?? null,
      openingBalance: String(newOpening),
      currentBalance: String(newCurrent),
      isActive: parsed.data.isActive ?? existing.isActive,
      notes: parsed.data.notes ?? null,
    })
    .where(eq(accountsTable.id, params.data.id))
    .returning();
  res.json(formatAccount(updated));
});

// DELETE /accounts/:id  (soft-delete: deactivate)
router.delete("/accounts/:id", async (req, res): Promise<void> => {
  if (!requireFinancialWrite(req, res)) return;
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .update(accountsTable)
    .set({ isActive: false })
    .where(eq(accountsTable.id, params.data.id));
  res.sendStatus(204);
});

// GET /cashbook — per-salesman pending cash + account balances
router.get("/cashbook", async (req, res): Promise<void> => {
  if (!requireFinancialRead(req, res)) return;
  // Approved cash payments not yet collected (accountId IS NULL) grouped by salesman
  const pendingRows = await db
    .select({
      salesmanId: paymentsTable.salesmanId,
      salesmanName: paymentsTable.salesmanName,
      pendingCash: sql<string>`COALESCE(SUM(${paymentsTable.amount}), 0)`,
      paymentCount: sql<string>`COUNT(*)::int`,
    })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.mode, "cash"),
        eq(paymentsTable.status, "approved"),
        isNull(paymentsTable.accountId),
        sql`${paymentsTable.salesmanId} IS NOT NULL`,
      ),
    )
    .groupBy(paymentsTable.salesmanId, paymentsTable.salesmanName);

  const salesmen = pendingRows.map((r) => ({
    salesmanId: r.salesmanId ?? 0,
    salesmanName: r.salesmanName ?? "Unknown",
    pendingCash: Number(r.pendingCash),
    paymentCount: Number(r.paymentCount),
  }));

  const totalPendingCash = salesmen.reduce((s, x) => s + x.pendingCash, 0);

  const accounts = await db
    .select()
    .from(accountsTable)
    .orderBy(sql`${accountsTable.isActive} DESC, ${accountsTable.type}, ${accountsTable.name}`);

  res.json({
    salesmen,
    totalPendingCash,
    accounts: accounts.map(formatAccount),
  });
});

// POST /cashbook/collect
router.post("/cashbook/collect", async (req, res): Promise<void> => {
  if (!requireFinancialWrite(req, res)) return;
  const parsed = CollectCashFromSalesmanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const session = (req as any).session;

  const { salesmanId, accountId, amount, notes } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // Verify account exists and is active
    const acctRes = await client.query(
      `SELECT id, current_balance FROM accounts WHERE id = $1 AND is_active = true FOR UPDATE`,
      [accountId],
    );
    if (acctRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Account not found or inactive" });
      return;
    }

    // Mark uncollected approved cash payments for this salesman as collected, up to `amount`.
    // Strategy: mark oldest payments first until cumulative sum reaches `amount`.
    const pendingRes = await client.query(
      `SELECT id, amount FROM payments
       WHERE salesman_id = $1 AND mode = 'cash' AND status = 'approved' AND account_id IS NULL
       ORDER BY created_at ASC`,
      [salesmanId],
    );

    let collected = 0;
    const idsToMark: number[] = [];
    for (const row of pendingRes.rows) {
      const next = collected + Number(row.amount);
      if (next > amount + 0.001) break;
      collected = next;
      idsToMark.push(row.id);
      if (Math.abs(collected - amount) < 0.001) break;
    }

    if (idsToMark.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No matching pending cash payments found for that amount" });
      return;
    }

    await client.query(
      `UPDATE payments
       SET account_id = $1, collected_at = NOW(), collected_by_id = $2
       WHERE id = ANY($3::int[])`,
      [accountId, session.userId, idsToMark],
    );

    const updAcct = await client.query(
      `UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 RETURNING *`,
      [collected, accountId],
    );

    await client.query("COMMIT");
    res.json({
      collectedCount: idsToMark.length,
      totalAmount: collected,
      account: formatAccount(updAcct.rows[0]),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Failed to collect cash");
    res.status(500).json({ error: "Failed to collect cash" });
  } finally {
    client.release();
  }
});

export default router;
