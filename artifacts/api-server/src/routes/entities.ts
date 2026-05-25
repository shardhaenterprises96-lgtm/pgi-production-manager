import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { entitiesTable, ledgerEntriesTable } from "@workspace/db";
import {
  ListEntitiesQueryParams,
  CreateEntityBody,
  LookupEntityByMobileQueryParams,
  GetEntityParams,
  UpdateEntityParams,
  UpdateEntityBody,
  GetEntityLedgerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /entities/lookup
router.get("/entities/lookup", async (req, res): Promise<void> => {
  const params = LookupEntityByMobileQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.mobile, params.data.mobile));

  if (!entity) {
    res.json({ found: false });
    return;
  }

  res.json({ found: true, entity: formatEntity(entity) });
});

// GET /entities
router.get("/entities", async (req, res): Promise<void> => {
  const params = ListEntitiesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: any[] = [];
  if (params.data.type) conditions.push(eq(entitiesTable.type, params.data.type));
  if (params.data.mobile) conditions.push(eq(entitiesTable.mobile, params.data.mobile));
  if (params.data.search) {
    conditions.push(
      or(
        ilike(entitiesTable.name, `%${params.data.search}%`),
        ilike(entitiesTable.mobile, `%${params.data.search}%`),
        ilike(entitiesTable.gstin ?? sql`''`, `%${params.data.search}%`)
      )
    );
  }

  const entities = conditions.length > 0
    ? await db.select().from(entitiesTable).where(and(...conditions)).orderBy(entitiesTable.name)
    : await db.select().from(entitiesTable).orderBy(entitiesTable.name);

  res.json(entities.map(formatEntity));
});

// POST /entities
router.post("/entities", async (req, res): Promise<void> => {
  const parsed = CreateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entity] = await db
    .insert(entitiesTable)
    .values({
      ...parsed.data,
      pricingTier: parsed.data.pricingTier ?? "retail",
    })
    .returning();

  res.status(201).json(formatEntity(entity));
});

// GET /entities/:id
router.get("/entities/:id", async (req, res): Promise<void> => {
  const params = GetEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, params.data.id));

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  res.json(formatEntity(entity));
});

// PATCH /entities/:id
router.patch("/entities/:id", async (req, res): Promise<void> => {
  const params = UpdateEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entity] = await db
    .update(entitiesTable)
    .set(parsed.data)
    .where(eq(entitiesTable.id, params.data.id))
    .returning();

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  res.json(formatEntity(entity));
});

// GET /entities/:id/ledger
router.get("/entities/:id/ledger", async (req, res): Promise<void> => {
  const params = GetEntityLedgerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, params.data.id));

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.entityId, params.data.id))
    .orderBy(sql`${ledgerEntriesTable.date} DESC`);

  res.json({
    entity: formatEntity(entity),
    outstandingBalance: Number(entity.outstandingBalance),
    entries: entries.map(formatLedgerEntry),
  });
});

function formatEntity(e: any) {
  return {
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
  };
}

function formatLedgerEntry(e: any) {
  return {
    id: e.id,
    date: e.date?.toISOString(),
    description: e.description,
    debit: Number(e.debit),
    credit: Number(e.credit),
    balance: Number(e.balance),
    type: e.type,
    referenceId: e.referenceId ?? null,
    referenceNo: e.referenceNo ?? null,
  };
}

export default router;
