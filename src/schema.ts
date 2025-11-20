import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index("idx_credentials_user_id").on(table.userId),
}));

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index("idx_sessions_user_id").on(table.userId),
  expiresAtIdx: index("idx_sessions_expires_at").on(table.expiresAt),
}));

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  userId: text("user_id"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  expiresAtIdx: index("idx_challenges_expires_at").on(table.expiresAt),
}));
