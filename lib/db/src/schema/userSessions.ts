import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userSessionsTable = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type UserSessionRecord = typeof userSessionsTable.$inferSelect;
