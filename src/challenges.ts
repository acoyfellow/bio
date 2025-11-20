import { eq, gt, lt } from "drizzle-orm";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/d1";

const CHALLENGE_TTL = 5 * 60; // 5 minutes in seconds

export async function storeChallenge(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
  challenge: string,
  userId?: string
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_TTL;
  await db.insert(schema.challenges).values({
    id: sessionId,
    challenge,
    userId,
    expiresAt,
  });
}

export async function getChallenge(
  db: ReturnType<typeof drizzle>,
  sessionId: string
): Promise<{ challenge: string; userId?: string | null } | null> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.id, sessionId))
    .limit(1);

  const stored = result[0];
  if (!stored || stored.expiresAt < now) {
    if (stored) await db.delete(schema.challenges).where(eq(schema.challenges.id, sessionId));
    return null;
  }

  return { challenge: stored.challenge, userId: stored.userId };
}

export async function deleteChallenge(db: ReturnType<typeof drizzle>, sessionId: string): Promise<void> {
  await db.delete(schema.challenges).where(eq(schema.challenges.id, sessionId));
}

export async function cleanupExpiredChallenges(db: ReturnType<typeof drizzle>): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.delete(schema.challenges).where(lt(schema.challenges.expiresAt, now));
}
