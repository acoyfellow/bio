import { drizzle } from "drizzle-orm/d1";
import { eq, and, gt, lt } from "drizzle-orm";
import * as schema from "./schema";

export type User = typeof schema.users.$inferSelect;
export type Credential = typeof schema.credentials.$inferSelect;
export type Session = typeof schema.sessions.$inferSelect;

export function getDb(env: D1Database) {
  return drizzle(env, { schema });
}

export async function createUser(db: ReturnType<typeof getDb>, username: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.users).values({
    id,
    username,
  });
  return id;
}

export async function getUserByUsername(db: ReturnType<typeof getDb>, username: string): Promise<User | null> {
  const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  return result[0] || null;
}

export async function getUserById(db: ReturnType<typeof getDb>, id: string): Promise<User | null> {
  const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return result[0] || null;
}

export async function saveCredential(
  db: ReturnType<typeof getDb>,
  userId: string,
  credentialId: string,
  publicKey: string
): Promise<void> {
  await db.insert(schema.credentials).values({
    id: credentialId,
    userId,
    publicKey,
  });
}

export async function getCredential(db: ReturnType<typeof getDb>, credentialId: string): Promise<Credential | null> {
  const result = await db.select().from(schema.credentials).where(eq(schema.credentials.id, credentialId)).limit(1);
  return result[0] || null;
}

export async function updateCredentialCounter(
  db: ReturnType<typeof getDb>,
  credentialId: string,
  newCounter: number
): Promise<boolean> {
  // Prevent counter rollback (cloned key detection)
  const cred = await getCredential(db, credentialId);
  if (!cred || newCounter <= cred.counter) {
    return false; // Counter not incremented - possible cloned key
  }
  await db.update(schema.credentials).set({ counter: newCounter }).where(eq(schema.credentials.id, credentialId));
  return true;
}

export async function createSession(
  db: ReturnType<typeof getDb>,
  userId: string,
  sessionId: string,
  expiresAt: number
): Promise<void> {
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });
}

export async function getSession(db: ReturnType<typeof getDb>, sessionId: string): Promise<Session | null> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  return result[0] || null;
}

export async function deleteSession(db: ReturnType<typeof getDb>, sessionId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function cleanupExpiredSessions(db: ReturnType<typeof getDb>): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
}

