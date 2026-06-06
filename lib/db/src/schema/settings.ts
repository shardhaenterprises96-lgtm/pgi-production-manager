import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Generic key/value application settings (e.g. default invoice template).
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Configurable document-number series. One row per series type
// (invoice / order / quotation). The number is assembled from the
// enabled tokens joined by `separator`:
//   [prefix] [year] [month] [paddedSeq]
export const numberSeriesTable = pgTable("number_series", {
  seriesType: text("series_type").primaryKey(), // invoice | order | quotation
  prefix: text("prefix").notNull().default(""),
  includeYear: boolean("include_year").notNull().default(true),
  includeMonth: boolean("include_month").notNull().default(true),
  yearFormat: text("year_format").notNull().default("calendar"), // calendar | fiscal
  separator: text("separator").notNull().default("/"),
  padding: integer("padding").notNull().default(0),
  startNumber: integer("start_number").notNull().default(1),
  nextNumber: integer("next_number").notNull().default(1),
  resetRule: text("reset_rule").notNull().default("monthly"), // never | daily | monthly | yearly | fiscal
  periodKey: text("period_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingSchema = createInsertSchema(appSettingsTable);
export const insertNumberSeriesSchema = createInsertSchema(numberSeriesTable);
export type AppSetting = typeof appSettingsTable.$inferSelect;
export type NumberSeries = typeof numberSeriesTable.$inferSelect;
export type NumberSeriesType = "invoice" | "order" | "quotation";
