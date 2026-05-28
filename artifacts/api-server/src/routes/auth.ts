import { Router, type IRouter } from "express";
import {
  USERS,
  validateCredentials,
  getActiveSession,
  createSession,
  destroySession,
  destroyUserSessions,
  deleteUserData,
  SESSION_DURATION_MS,
} from "../lib/auth.js";

const router: IRouter = Router();

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { userId, password } = req.body as { userId?: string; password?: string };

  if (!userId || !password) {
    res.status(400).json({ error: "userId and password are required" });
    return;
  }

  if (!validateCredentials(userId, password)) {
    res.status(401).json({ error: "Invalid user ID or password" });
    return;
  }

  const existing = await getActiveSession(userId);
  if (existing) {
    res.status(409).json({
      error: `User ${userId} is already logged in. Try another account.`,
      code: "ALREADY_LOGGED_IN",
    });
    return;
  }

  await destroyUserSessions(userId);

  const { id: token, expiresAt } = await createSession(userId);

  res.json({
    token,
    userId,
    expiresAt: expiresAt.toISOString(),
    sessionDurationMs: SESSION_DURATION_MS,
  });
});

// POST /auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.headers["x-session-token"] as string | undefined;
  if (token) {
    await destroySession(token, true);
  }
  res.json({ ok: true });
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { getSessionByToken } = await import("../lib/auth.js");
  const session = await getSessionByToken(token);
  if (!session || session.expiresAt <= new Date()) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  res.json({
    userId: session.userId,
    expiresAt: session.expiresAt.toISOString(),
  });
});

export default router;
