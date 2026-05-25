import { pgTable, text, serial, timestamp, integer, boolean, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entitiesTable = pgTable("entities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // customer, vendor, worker, salesman
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  gstin: text("gstin"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pricingTier: text("pricing_tier").default("retail"), // retail, wholesale
  outstandingBalance: numeric("outstanding_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  userId: integer("user_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("entities_mobile_idx").on(t.mobile),
  index("entities_type_idx").on(t.type),
]);

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().references(() => entitiesTable.id),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  description: text("description").notNull(),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  type: text("type").notNull(), // invoice, payment, adjustment
  referenceId: integer("reference_id"),
  referenceNo: text("reference_no"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ledger_entity_idx").on(t.entityId),
]);

export const insertEntitySchema = createInsertSchema(entitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entitiesTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
