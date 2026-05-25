import {
  pgTable, text, serial, timestamp, integer, boolean, numeric, index, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const shopInventoryTable = pgTable("shop_inventory", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  currentStock: numeric("current_stock", { precision: 12, scale: 3 }).notNull().default("0"),
  minStockThreshold: numeric("min_stock_threshold", { precision: 12, scale: 3 }).notNull().default("0"),
  sourceType: text("source_type").notNull().default("factory"),
  shopRetailPrice: numeric("shop_retail_price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("shop_inventory_loc_product_uq").on(t.locationId, t.productId),
  index("shop_inventory_location_idx").on(t.locationId),
]);

export const shopStockMovementsTable = pgTable("shop_stock_movements", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  type: text("type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  reason: text("reason").notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shop_stock_movements_loc_product_idx").on(t.locationId, t.productId),
]);

export const stockTransfersTable = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  transferNo: text("transfer_no").notNull().unique(),
  fromLocationId: integer("from_location_id").notNull().references(() => locationsTable.id),
  toLocationId: integer("to_location_id").notNull().references(() => locationsTable.id),
  status: text("status").notNull().default("requested"),
  notes: text("notes"),
  linkedWorkloadCardId: integer("linked_workload_card_id"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("stock_transfers_to_loc_idx").on(t.toLocationId),
  index("stock_transfers_status_idx").on(t.status),
]);

export const stockTransferItemsTable = pgTable("stock_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => stockTransfersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  requestedQty: numeric("requested_qty", { precision: 12, scale: 3 }).notNull(),
  dispatchedQty: numeric("dispatched_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }).notNull().default("0"),
}, (t) => [
  index("stock_transfer_items_transfer_idx").on(t.transferId),
]);

export const posSalesTable = pgTable("pos_sales", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  billNo: text("bill_no").notNull().unique(),
  customerName: text("customer_name"),
  customerMobile: text("customer_mobile"),
  paymentMode: text("payment_mode").notNull().default("cash"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pos_sales_location_date_idx").on(t.locationId, t.createdAt),
]);

export const posSaleItemsTable = pgTable("pos_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => posSalesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
}, (t) => [
  index("pos_sale_items_sale_idx").on(t.saleId),
]);

export const shopPurchasesTable = pgTable("shop_purchases", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  billNo: text("bill_no"),
  vendorName: text("vendor_name").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shop_purchases_location_date_idx").on(t.locationId, t.createdAt),
]);

export const shopPurchaseItemsTable = pgTable("shop_purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => shopPurchasesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
}, (t) => [
  index("shop_purchase_items_purchase_idx").on(t.purchaseId),
]);

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Location = typeof locationsTable.$inferSelect;
export type ShopInventory = typeof shopInventoryTable.$inferSelect;
export type ShopStockMovement = typeof shopStockMovementsTable.$inferSelect;
export type StockTransfer = typeof stockTransfersTable.$inferSelect;
export type StockTransferItem = typeof stockTransferItemsTable.$inferSelect;
export type PosSale = typeof posSalesTable.$inferSelect;
export type PosSaleItem = typeof posSaleItemsTable.$inferSelect;
export type ShopPurchase = typeof shopPurchasesTable.$inferSelect;
export type ShopPurchaseItem = typeof shopPurchaseItemsTable.$inferSelect;
