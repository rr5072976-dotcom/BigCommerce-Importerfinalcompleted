import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storeSettingsTable = pgTable("store_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("legacy"),
  label: text("label"),
  storeHash: text("store_hash").notNull(),
  accessToken: text("access_token").notNull(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  storeName: text("store_name"),
  storeUrl: text("store_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoreSettingsRecord = typeof storeSettingsTable.$inferSelect;
