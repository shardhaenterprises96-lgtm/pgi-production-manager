import { pgTable, serial, timestamp, numeric, date } from "drizzle-orm/pg-core";

export const capitalSnapshotsTable = pgTable("capital_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull().unique(),
  inventoryValue: numeric("inventory_value", { precision: 16, scale: 2 }).notNull().default("0"),
  receivable: numeric("receivable", { precision: 16, scale: 2 }).notNull().default("0"),
  cashInAccounts: numeric("cash_in_accounts", { precision: 16, scale: 2 }).notNull().default("0"),
  payable: numeric("payable", { precision: 16, scale: 2 }).notNull().default("0"),
  expenses: numeric("expenses", { precision: 16, scale: 2 }).notNull().default("0"),
  capital: numeric("capital", { precision: 16, scale: 2 }).notNull().default("0"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CapitalSnapshot = typeof capitalSnapshotsTable.$inferSelect;
