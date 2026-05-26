import { pgTable, text, serial, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const customerOrdersTable = pgTable("customer_orders", {
  id: serial("id").primaryKey(),
  orderNo: text("order_no"),
  userId: integer("user_id"),
  entityId: integer("entity_id"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile"),
  status: text("status").notNull().default("pending"), // pending, processing, done, cancelled
  totalItems: integer("total_items").notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  adminRemarks: text("admin_remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("customer_orders_user_idx").on(t.userId),
  index("customer_orders_status_idx").on(t.status),
]);

export const customerOrderItemsTable = pgTable("customer_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  unit: text("unit"),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  workloadCardId: integer("workload_card_id"),
}, (t) => [
  index("customer_order_items_order_idx").on(t.orderId),
]);

export type CustomerOrder = typeof customerOrdersTable.$inferSelect;
export type CustomerOrderItem = typeof customerOrderItemsTable.$inferSelect;
