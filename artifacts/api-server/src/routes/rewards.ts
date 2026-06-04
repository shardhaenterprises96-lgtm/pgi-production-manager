import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  rewardSchemesTable,
  rewardProgressTable,
  productsTable,
  entitiesTable,
} from "@workspace/db";
import {
  CreateRewardSchemeBody,
  UpdateRewardSchemeParams,
  UpdateRewardSchemeBody,
  DeleteRewardSchemeParams,
  ListRewardProgressQueryParams,
  DisburseRewardParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /reward-schemes
router.get("/reward-schemes", async (_req, res): Promise<void> => {
  const schemes = await db
    .select({
      scheme: rewardSchemesTable,
      productName: productsTable.name,
    })
    .from(rewardSchemesTable)
    .leftJoin(productsTable, eq(rewardSchemesTable.productId, productsTable.id));

  res.json(schemes.map(({ scheme, productName }) => formatScheme(scheme, productName)));
});

// POST /reward-schemes
router.post("/reward-schemes", async (req, res): Promise<void> => {
  const parsed = CreateRewardSchemeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scheme] = await db.insert(rewardSchemesTable).values({
    ...parsed.data,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    targetLiters: String(parsed.data.targetLiters),
  }).returning();

  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, scheme.productId));
  res.status(201).json(formatScheme(scheme, product?.name ?? null));
});

// PATCH /reward-schemes/:id
router.patch("/reward-schemes/:id", async (req, res): Promise<void> => {
  const params = UpdateRewardSchemeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRewardSchemeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.startDate) updateData.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) updateData.endDate = new Date(parsed.data.endDate);
  if (parsed.data.targetLiters) updateData.targetLiters = String(parsed.data.targetLiters);

  const [scheme] = await db.update(rewardSchemesTable)
    .set(updateData)
    .where(eq(rewardSchemesTable.id, params.data.id))
    .returning();

  if (!scheme) {
    res.status(404).json({ error: "Scheme not found" });
    return;
  }

  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, scheme.productId));
  res.json(formatScheme(scheme, product?.name ?? null));
});

// DELETE /reward-schemes/:id
router.delete("/reward-schemes/:id", async (req, res): Promise<void> => {
  const params = DeleteRewardSchemeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scheme] = await db.delete(rewardSchemesTable).where(eq(rewardSchemesTable.id, params.data.id)).returning();
  if (!scheme) {
    res.status(404).json({ error: "Scheme not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /reward-progress
router.get("/reward-progress", async (req, res): Promise<void> => {
  const params = ListRewardProgressQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: any[] = [];
  if (params.data.customerId) conditions.push(eq(rewardProgressTable.customerId, params.data.customerId));

  const rows = conditions.length > 0
    ? await db
        .select({
          progress: rewardProgressTable,
          scheme: rewardSchemesTable,
          customerName: entitiesTable.name,
          productName: productsTable.name,
        })
        .from(rewardProgressTable)
        .leftJoin(rewardSchemesTable, eq(rewardProgressTable.schemeId, rewardSchemesTable.id))
        .leftJoin(entitiesTable, eq(rewardProgressTable.customerId, entitiesTable.id))
        .leftJoin(productsTable, eq(rewardSchemesTable.productId, productsTable.id))
        .where(and(...conditions))
    : await db
        .select({
          progress: rewardProgressTable,
          scheme: rewardSchemesTable,
          customerName: entitiesTable.name,
          productName: productsTable.name,
        })
        .from(rewardProgressTable)
        .leftJoin(rewardSchemesTable, eq(rewardProgressTable.schemeId, rewardSchemesTable.id))
        .leftJoin(entitiesTable, eq(rewardProgressTable.customerId, entitiesTable.id))
        .leftJoin(productsTable, eq(rewardSchemesTable.productId, productsTable.id));

  res.json(rows.map(({ progress, scheme, customerName, productName }) =>
    formatProgress(progress, scheme, customerName, productName)
  ));
});

// POST /reward-progress/:id/disburse
router.post("/reward-progress/:id/disburse", async (req, res): Promise<void> => {
  const params = DisburseRewardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [progress] = await db.update(rewardProgressTable)
    .set({ isDisbursed: true, disbursedAt: new Date() })
    .where(eq(rewardProgressTable.id, params.data.id))
    .returning();

  if (!progress) {
    res.status(404).json({ error: "Reward progress not found" });
    return;
  }

  const [scheme] = await db.select().from(rewardSchemesTable).where(eq(rewardSchemesTable.id, progress.schemeId));
  const [entity] = await db.select({ name: entitiesTable.name }).from(entitiesTable).where(eq(entitiesTable.id, progress.customerId));
  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, scheme?.productId ?? 0));

  res.json(formatProgress(progress, scheme, entity?.name ?? null, product?.name ?? null));
});

function formatScheme(s: any, productName: string | null) {
  return {
    id: s.id,
    schemeName: s.schemeName ?? null,
    productId: s.productId,
    productName: productName ?? null,
    targetLiters: Number(s.targetLiters),
    rewardType: s.rewardType,
    rewardValue: s.rewardValue,
    startDate: s.startDate?.toISOString?.() ?? s.startDate,
    endDate: s.endDate?.toISOString?.() ?? s.endDate,
    isActive: s.isActive,
    createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
  };
}

function formatProgress(p: any, scheme: any, customerName: string | null, productName: string | null) {
  const achieved = Number(p.litersAchieved);
  const target = scheme ? Number(scheme.targetLiters) : 1;
  const pct = Math.min(100, Math.round((achieved / target) * 100));
  return {
    id: p.id,
    schemeId: p.schemeId,
    customerId: p.customerId,
    customerName: customerName ?? null,
    productName: productName ?? null,
    targetLiters: target,
    litersAchieved: achieved,
    progressPct: pct,
    isRewardAchieved: p.isRewardAchieved,
    isDisbursed: p.isDisbursed,
    rewardType: scheme?.rewardType ?? "",
    rewardValue: scheme?.rewardValue ?? "",
    schemeEndDate: scheme?.endDate?.toISOString?.() ?? "",
  };
}

export default router;
