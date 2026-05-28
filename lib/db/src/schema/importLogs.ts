import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importLogsTable = pgTable("import_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  status: text("status").notNull(), // success | error | processing
  message: text("message").notNull(),
  payload: text("payload"),
  entityId: text("entity_id"), // BC order/customer/product ID on success
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportLogSchema = createInsertSchema(importLogsTable).omit({ createdAt: true });
export type InsertImportLog = z.infer<typeof insertImportLogSchema>;
export type ImportLogRecord = typeof importLogsTable.$inferSelect;
