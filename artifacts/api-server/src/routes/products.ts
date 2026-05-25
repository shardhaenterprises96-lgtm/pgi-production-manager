import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, or, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  productsTable,
  stockMovementsTable,
} from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetProductStockMovementsParams,
  CreateStockMovementParams,
  CreateStockMovementBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /products
router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, group, brand, forSale, forManufacturing } = params.data;

  let query = db.select().from(productsTable);
  const conditions: any[] = [isNull(productsTable.deletedAt)];

  if (search) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.itemCode, `%${search}%`),
        ilike(productsTable.brand, `%${search}%`)
      )
    );
  }
  if (group) conditions.push(eq(productsTable.group, group));
  if (brand) conditions.push(eq(productsTable.brand, brand));
  if (forSale === true) conditions.push(eq(productsTable.notForSale, false));
  if (forManufacturing === true) conditions.push(eq(productsTable.addForManufacturing, true));

  const products = await query.where(and(...conditions)).orderBy(productsTable.name);

  res.json(products.map(formatProduct));
});

// POST /products
router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Compute prices based on pricing basis
  let retailPrice = data.retailPrice;
  let wholesalePrice = data.wholesalePrice;

  if (data.pricingBasis === "fixed_margin" && data.purchasePrice != null) {
    const purchase = Number(data.purchasePrice);
    if (data.wholesaleMargin != null) wholesalePrice = purchase + Number(data.wholesaleMargin);
    if (data.retailMargin != null) retailPrice = purchase + Number(data.retailMargin);
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      ...data,
      retailPrice: String(retailPrice),
      wholesalePrice: String(wholesalePrice),
      currentStock: String(data.openingStock ?? 0),
    })
    .returning();

  // Log opening stock movement if any
  if (data.openingStock && Number(data.openingStock) > 0) {
    await db.insert(stockMovementsTable).values({
      productId: product.id,
      type: "inward",
      quantity: String(data.openingStock),
      reason: "Opening stock",
      userId: 1,
    });
  }

  res.status(201).json(formatProduct(product));
});

// GET /products/groups
router.get("/products/groups", async (_req, res): Promise<void> => {
  const result = await db
    .selectDistinct({ group: productsTable.group })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(productsTable.group);
  res.json(result.map((r) => r.group));
});

// GET /products/brands
router.get("/products/brands", async (_req, res): Promise<void> => {
  const result = await db
    .selectDistinct({ brand: productsTable.brand })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(productsTable.brand);
  res.json(result.map((r) => r.brand));
});

// GET /products/:id
router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, params.data.id), isNull(productsTable.deletedAt)));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product));
});

// PATCH /products/:id
router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Recompute prices if fixed margin
  if (data.pricingBasis === "fixed_margin") {
    const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
    if (existing) {
      const purchase = Number(data.purchasePrice ?? existing.purchasePrice);
      if (data.wholesaleMargin != null) data.wholesalePrice = purchase + Number(data.wholesaleMargin);
      if (data.retailMargin != null) data.retailPrice = purchase + Number(data.retailMargin);
    }
  }

  const updateData: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateData[k] = v;
  }

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product));
});

// DELETE /products/:id
router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Soft-delete: products are referenced by invoice_items, stock_movements,
  // BOMs, and rewards. A hard DELETE would either violate FK constraints or
  // destroy historical invoice/audit context. Instead we set deleted_at so
  // the product disappears from catalog/inventory listings while existing
  // references continue to resolve.
  const [product] = await db
    .update(productsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(productsTable.id, params.data.id), isNull(productsTable.deletedAt)))
    .returning();

  if (!product) {
    // Either no such product, or it was already deleted — treat both as 404
    // so the UI's optimistic refresh resolves cleanly.
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

// GET /products/:id/stock-movements
router.get("/products/:id/stock-movements", async (req, res): Promise<void> => {
  const params = GetProductStockMovementsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const movements = await db
    .select()
    .from(stockMovementsTable)
    .where(eq(stockMovementsTable.productId, params.data.id))
    .orderBy(sql`${stockMovementsTable.createdAt} DESC`);

  res.json(movements.map(formatMovement));
});

// POST /products/:id/stock-movements
router.post("/products/:id/stock-movements", async (req, res): Promise<void> => {
  const params = CreateStockMovementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  const userId = session?.userId ?? 1;

  const [movement] = await db.insert(stockMovementsTable).values({
    productId: params.data.id,
    type: parsed.data.type,
    quantity: String(parsed.data.quantity),
    reason: parsed.data.reason,
    referenceId: parsed.data.referenceId ?? null,
    referenceType: parsed.data.referenceType ?? null,
    userId,
  }).returning();

  // Update stock
  const delta = ["inward", "manufacturing_produce"].includes(parsed.data.type)
    ? parsed.data.quantity
    : -parsed.data.quantity;

  await db
    .update(productsTable)
    .set({ currentStock: sql`${productsTable.currentStock} + ${delta}` })
    .where(eq(productsTable.id, params.data.id));

  res.status(201).json(formatMovement(movement));
});

function formatProduct(p: any) {
  return {
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
    unitsPerBox: p.unitsPerBox != null ? Number(p.unitsPerBox) : null,
    notForSale: p.notForSale,
    addForManufacturing: p.addForManufacturing,
    minStockThreshold: p.minStockThreshold != null ? Number(p.minStockThreshold) : null,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt?.toISOString(),
  };
}

function formatMovement(m: any) {
  return {
    id: m.id,
    productId: m.productId,
    type: m.type,
    quantity: Number(m.quantity),
    reason: m.reason,
    referenceId: m.referenceId ?? null,
    referenceType: m.referenceType ?? null,
    userId: m.userId,
    createdAt: m.createdAt?.toISOString(),
  };
}

export default router;
