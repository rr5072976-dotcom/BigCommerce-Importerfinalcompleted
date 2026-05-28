import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importJobsTable = pgTable("import_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("legacy"),
  type: text("type").notNull(), // customers | products | orders
  status: text("status").notNull().default("pending"), // pending | running | paused | completed | failed
  totalRows: integer("total_rows").notNull().default(0),
  processedRows: integer("processed_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  delayMs: integer("delay_ms").notNull().default(500),
  autoCompleteStatusId: integer("auto_complete_status_id"), // if set, auto-update BC order status after import
  storeHash: text("store_hash").notNull(),
  accessToken: text("access_token").notNull(),
  csvData: text("csv_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertImportJobSchema = createInsertSchema(importJobsTable).omit({ createdAt: true, completedAt: true });
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJobRecord = typeof importJobsTable.$inferSelect;
