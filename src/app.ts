import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import path from "path";
import { env } from "./config/env.config.js";
import { logger } from "./lib/logger.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import routes from "./routes/index.js";
import uploadRoutes from "./routes/upload.routes.js";
import { AppError } from "./errors/index.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(pinoHttp({ logger, autoLogging: false }) as express.RequestHandler);
app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "API Express en ligne" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api", routes);
app.use("/api/upload", uploadRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route introuvable" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error(err, "Erreur non gérée");
  res.status(500).json({ error: "Erreur interne du serveur" });
});

export default app;
