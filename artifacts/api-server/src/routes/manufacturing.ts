import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  bomsTable,
  bomItemsTable,
  workloadCardsTable,
  productsTable,
  stockMovementsTable,
} from "@workspace/db";
import {
  CreateBomBody,
  GetBomParams,
  UpdateBomParams,
  UpdateBomBody,
  ListWorkloadCardsQueryParams,
  CreateWorkloadCardBody,
  UpdateWorkloadCardBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /boms
router.get("/boms", async (_req, res): Promise<void> => {
  const boms = await db
    .select({
      bom: bomsTable,
      productName: productsTable.name,
    })
    .from(bomsTable)
    .leftJoin(productsTable, eq(bomsTable.finishedProductId, productsTable.id));

  const result = await Promise.all(
    boms.map(async ({ bom, productName }) => {
      const items = await db
        .select({
          item: bomItemsTable,
          materialName: productsTable.name,
        })
        .from(bomItemsTable)
        .leftJoin(productsTable, eq(bomItemsTable.materialProductId, productsTable.id))
        .where(eq(bomItemsTable.bomId, bom.id));

      return formatBom(bom, productName, items);
    })
  );

  res.json(result);
});

// POST /boms
router.post("/boms", async (req, res): Promise<void> => {
  const parsed = CreateBomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Extra validation: positive quantities, no self-referencing materials, no duplicates
  if (Number(parsed.data.outputQuantity) <= 0) {
    res.status(400).json({ error: "outputQuantity must be greater than 0" });
    return;
  }
  const seenMaterials = new Set<number>();
  for (const item of parsed.data.items) {
    if (Number(item.quantity) <= 0) {
      res.status(400).json({ error: "Each material quantity must be greater than 0" });
      return;
    }
    if (item.materialProductId === parsed.data.finishedProductId) {
      res.status(400).json({ error: "A product cannot be a material of itself" });
      return;
    }
    if (seenMaterials.has(item.materialProductId)) {
      res.status(400).json({ error: "Duplicate material in BOM" });
      return;
    }
    seenMaterials.add(item.materialProductId);
  }

  const client = await pool.connect();
  let bomId: number;
  try {
    await client.query("BEGIN");
    const bomResult = await client.query(
      `INSERT INTO boms (finished_product_id, output_quantity) VALUES ($1, $2) RETURNING id`,
      [parsed.data.finishedProductId, String(parsed.data.outputQuantity)],
    );
    bomId = bomResult.rows[0].id;

    for (const item of parsed.data.items) {
      await client.query(
        `INSERT INTO bom_items (bom_id, material_product_id, quantity, unit) VALUES ($1, $2, $3, $4)`,
        [bomId, item.materialProductId, String(item.quantity), item.unit],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Failed to create BOM");
    res.status(500).json({ error: "Failed to create BOM" });
    return;
  } finally {
    client.release();
  }

  const [bom] = await db.select().from(bomsTable).where(eq(bomsTable.id, bomId));
  const items = await db
    .select({ item: bomItemsTable, materialName: productsTable.name })
    .from(bomItemsTable)
    .leftJoin(productsTable, eq(bomItemsTable.materialProductId, productsTable.id))
    .where(eq(bomItemsTable.bomId, bomId));
  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, bom.finishedProductId));

  res.status(201).json(formatBom(bom, product?.name ?? null, items));
});

// GET /boms/:id
router.get("/boms/:id", async (req, res): Promise<void> => {
  const params = GetBomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [bom] = await db.select().from(bomsTable).where(eq(bomsTable.id, params.data.id));
  if (!bom) {
    res.status(404).json({ error: "BOM not found" });
    return;
  }

  const items = await db
    .select({ item: bomItemsTable, materialName: productsTable.name })
    .from(bomItemsTable)
    .leftJoin(productsTable, eq(bomItemsTable.materialProductId, productsTable.id))
    .where(eq(bomItemsTable.bomId, bom.id));

  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, bom.finishedProductId));

  res.json(formatBom(bom, product?.name ?? null, items));
});

// PATCH /boms/:id
router.patch("/boms/:id", async (req, res): Promise<void> => {
  const params = UpdateBomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = {};
  if (parsed.data.outputQuantity != null) updateData.outputQuantity = String(parsed.data.outputQuantity);

  let bom: any;
  if (Object.keys(updateData).length > 0) {
    [bom] = await db.update(bomsTable).set(updateData).where(eq(bomsTable.id, params.data.id)).returning();
  } else {
    [bom] = await db.select().from(bomsTable).where(eq(bomsTable.id, params.data.id));
  }

  if (!bom) {
    res.status(404).json({ error: "BOM not found" });
    return;
  }

  if (parsed.data.items) {
    await db.delete(bomItemsTable).where(eq(bomItemsTable.bomId, params.data.id));
    for (const item of parsed.data.items) {
      if (item.materialProductId && item.quantity) {
        await db.insert(bomItemsTable).values({
          bomId: params.data.id,
          materialProductId: item.materialProductId,
          quantity: String(item.quantity),
          unit: item.unit ?? "QTY",
        });
      }
    }
  }

  const items = await db
    .select({ item: bomItemsTable, materialName: productsTable.name })
    .from(bomItemsTable)
    .leftJoin(productsTable, eq(bomItemsTable.materialProductId, productsTable.id))
    .where(eq(bomItemsTable.bomId, bom.id));

  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, bom.finishedProductId));

  res.json(formatBom(bom, product?.name ?? null, items));
});

// GET /workload
router.get("/workload", async (req, res): Promise<void> => {
  const params = ListWorkloadCardsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: any[] = [];
  if (params.data.status) conditions.push(eq(workloadCardsTable.status, params.data.status));

  const cards = conditions.length > 0
    ? await db
        .select({ card: workloadCardsTable, productName: productsTable.name, productImageUrl: productsTable.imageUrl })
        .from(workloadCardsTable)
        .leftJoin(productsTable, eq(workloadCardsTable.productId, productsTable.id))
        .where(and(...conditions))
        .orderBy(sql`${workloadCardsTable.createdAt} DESC`)
    : await db
        .select({ card: workloadCardsTable, productName: productsTable.name, productImageUrl: productsTable.imageUrl })
        .from(workloadCardsTable)
        .leftJoin(productsTable, eq(workloadCardsTable.productId, productsTable.id))
        .orderBy(sql`${workloadCardsTable.createdAt} DESC`);

  res.json(cards.map(({ card, productName, productImageUrl }) => formatWorkloadCard(card, productName, productImageUrl)));
});

// POST /workload
router.post("/workload", async (req, res): Promise<void> => {
  const parsed = CreateWorkloadCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [card] = await db.insert(workloadCardsTable).values({
    productId: parsed.data.productId,
    targetQty: String(parsed.data.targetQty),
    orderType: parsed.data.orderType,
    workerId: parsed.data.workerId ?? null,
    referenceOrderId: parsed.data.referenceOrderId ?? null,
    status: "pending",
  }).returning();

  const [product] = await db.select({ name: productsTable.name, imageUrl: productsTable.imageUrl })
    .from(productsTable).where(eq(productsTable.id, card.productId));

  res.status(201).json(formatWorkloadCard(card, product?.name ?? null, product?.imageUrl ?? null));
});

// PATCH /workload/:id
router.patch("/workload/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateWorkloadCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(workloadCardsTable).where(eq(workloadCardsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Workload card not found" });
    return;
  }

  const updateData: any = {};
  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "processing" && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (parsed.data.status === "done") {
      updateData.completedAt = new Date();

      // Execute BOM recipe: consume raw materials, produce finished good
      const client = await pool.connect();
      try {
        await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

        const [bom] = await db.select().from(bomsTable).where(eq(bomsTable.finishedProductId, existing.productId));
        if (bom) {
          const bomItems = await db.select().from(bomItemsTable).where(eq(bomItemsTable.bomId, bom.id));
          const targetQty = Number(existing.targetQty);
          const outputQty = Number(bom.outputQuantity);
          const batchMultiplier = targetQty / outputQty;

          for (const item of bomItems) {
            const consumeQty = Number(item.quantity) * batchMultiplier;
            await client.query(
              `INSERT INTO stock_movements (product_id, type, quantity, reason, reference_id, reference_type, user_id)
               VALUES ($1, 'manufacturing_consume', $2, 'Manufacturing batch', $3, 'workload', 1)`,
              [item.materialProductId, consumeQty, id]
            );
            await client.query(
              `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`,
              [consumeQty, item.materialProductId]
            );
          }
        }

        // Produce finished good
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reason, reference_id, reference_type, user_id)
           VALUES ($1, 'manufacturing_produce', $2, 'Manufacturing complete', $3, 'workload', 1)`,
          [existing.productId, existing.targetQty, id]
        );
        await client.query(
          `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
          [existing.targetQty, existing.productId]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error({ err }, "Failed to execute manufacturing recipe");
      } finally {
        client.release();
      }
    }
  }

  if (parsed.data.workerId != null) updateData.workerId = parsed.data.workerId;

  const [card] = await db.update(workloadCardsTable).set(updateData).where(eq(workloadCardsTable.id, id)).returning();
  const [product] = await db.select({ name: productsTable.name, imageUrl: productsTable.imageUrl })
    .from(productsTable).where(eq(productsTable.id, card.productId));

  res.json(formatWorkloadCard(card, product?.name ?? null, product?.imageUrl ?? null));
});

function formatBom(bom: any, productName: string | null, items: any[]) {
  return {
    id: bom.id,
    finishedProductId: bom.finishedProductId,
    finishedProductName: productName ?? null,
    outputQuantity: Number(bom.outputQuantity),
    items: items.map(({ item, materialName }) => ({
      id: item.id,
      bomId: item.bomId,
      materialProductId: item.materialProductId,
      materialProductName: materialName ?? null,
      quantity: Number(item.quantity),
      unit: item.unit,
    })),
    createdAt: bom.createdAt?.toISOString?.() ?? bom.createdAt,
  };
}

function formatWorkloadCard(c: any, productName: string | null, productImageUrl: string | null) {
  return {
    id: c.id,
    productId: c.productId,
    productName: productName ?? null,
    productImageUrl: productImageUrl ?? null,
    targetQty: Number(c.targetQty),
    status: c.status,
    workerId: c.workerId ?? null,
    workerName: c.workerName ?? null,
    orderType: c.orderType,
    referenceOrderId: c.referenceOrderId ?? null,
    startedAt: c.startedAt ? c.startedAt.toISOString() : null,
    completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
  };
}

export default router;
