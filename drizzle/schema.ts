import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const downloadJobs = mysqlTable("download_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  mediaId: varchar("mediaId", { length: 128 }).notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  title: text("title").notNull(),
  creator: text("creator"),
  duration: varchar("duration", { length: 32 }),
  formatId: varchar("formatId", { length: 64 }).notNull(),
  container: varchar("container", { length: 16 }).notNull(),
  quality: varchar("quality", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "expired", "cancelled"]).default("completed").notNull(),
  downloadUrl: text("downloadUrl"),
  filename: varchar("filename", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"),
});

export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  defaultFormat: varchar("defaultFormat", { length: 16 }).default("mp4").notNull(),
  preferredQuality: varchar("preferredQuality", { length: 16 }).default("720p").notNull(),
  theme: mysqlEnum("theme", ["light", "dark", "system"]).default("system").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const usageCounters = mysqlTable("usage_counters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  periodStart: timestamp("periodStart").notNull(),
  analyses: int("analyses").default(0).notNull(),
  downloads: int("downloads").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type DownloadJob = typeof downloadJobs.$inferSelect;
export type InsertDownloadJob = typeof downloadJobs.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
