import { type Request, type Response, type NextFunction } from "express";
import { getSessionByToken } from "../lib/auth.js";
import { deleteUserData, destroyUserSessions } from "../lib/auth.js";

const SKIP_PATHS = ["/api/auth/login", "/api/auth/logout", "/api/healthz", "/api/templates/"];

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (SKIP_PATHS.some((p) => req.path === p || req.path.startsWith(p))) {
    return next();
  }

  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated", code: "NO_SESSION" });
    return;
  }

  const session = await getSessionByToken(token);
  if (!session) {
    res.status(401).json({ error: "Session not found. Please log in.", code: "SESSION_NOT_FOUND" });
    return;
  }

  if (session.expiresAt <= new Date()) {
    await deleteUserData(session.userId);
    await destroyUserSessions(session.userId);
    res.status(401).json({ error: "Session expired. Your data has been reset for a fresh start.", code: "SESSION_EXPIRED" });
    return;
  }

  (req as Request & { userId: string }).userId = session.userId;
  next();
}
