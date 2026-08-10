import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import path from "path";
import { env } from "./config/env.config.js";
import { logger } from "./lib/logger.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import routes from "./routes/index.js";
import uploadRoutes from "./routes/upload.routes.js";
import { AppError } from "./errors/index.js";
import { rejectMaliciousInput } from "./middlewares/validation.middleware.js";

const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  next();
});

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(pinoHttp({ logger, autoLogging: false }) as express.RequestHandler);
app.use(globalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "API Express en ligne" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(
  "/uploads",
  express.static(path.resolve("uploads"), { dotfiles: "deny", index: false }),
);

// Rejette tout payload XSS dans body / query / params, pour toutes les routes
app.use(rejectMaliciousInput);

// Garantit que les réponses de l'API sont typées en application/json
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.type("json");
  next();
});

// Aucune réponse d'API ne doit être mise en cache par le navigateur ou un proxy
app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  next();
});

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
