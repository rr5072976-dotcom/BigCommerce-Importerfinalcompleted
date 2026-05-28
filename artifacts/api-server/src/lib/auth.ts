import { randomUUID } from "crypto";
import { eq, lt } from "drizzle-orm";
import { db, userSessionsTable, storeSettingsTable, importJobsTable, importLogsTable } from "@workspace/db";

export const USERS: Record<string, string> = {
  Black1: "4824",
  Black2: "4824",
  Black3: "4824",
  Black4: "4824",
  Black5: "4824",
};

export const SESSION_DURATION_MS = 18 * 60 * 60 * 1000;

export function validateCredentials(userId: string, password: string): boolean {
  return USERS[userId] === password;
}

export async function getActiveSession(userId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.userId, userId));

  for (const row of rows) {
    if (row.expiresAt > now) {
      return row;
    }
  }
  return null;
}

export async function getSessionByToken(token: string) {
  const [session] = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.id, token))
    .limit(1);
  return session ?? null;
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(userSessionsTable).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function deleteUserData(userId: string) {
  const jobs = await db
    .select({ id: importJobsTable.id })
    .from(importJobsTable)
    .where(eq(importJobsTable.userId, userId));

  for (const job of jobs) {
    await db.delete(importLogsTable).where(eq(importLogsTable.jobId, job.id));
  }
  await db.delete(importJobsTable).where(eq(importJobsTable.userId, userId));
  await db.delete(storeSettingsTable).where(eq(storeSettingsTable.userId, userId));
}

export async function destroySession(token: string, deleteData = false) {
  const session = await getSessionByToken(token);
  if (!session) return;
  if (deleteData) {
    await deleteUserData(session.userId);
  }
  await db.delete(userSessionsTable).where(eq(userSessionsTable.id, token));
}

export async function destroyUserSessions(userId: string) {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
}

export async function cleanupExpiredSessions() {
  const now = new Date();
  const expired = await db
    .select()
    .from(userSessionsTable)
    .where(lt(userSessionsTable.expiresAt, now));

  for (const session of expired) {
    await deleteUserData(session.userId);
    await db.delete(userSessionsTable).where(eq(userSessionsTable.id, session.id));
  }
}
