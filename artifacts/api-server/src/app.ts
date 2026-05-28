import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./middleware/session.js";
import { cleanupExpiredSessions } from "./lib/auth.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use("/api", router);

// Background cleanup: purge expired sessions + user data every 10 minutes
setInterval(() => {
  cleanupExpiredSessions().catch((err) => logger.error({ err }, "Session cleanup error"));
}, 10 * 60 * 1000);

export default app;
