import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

const noop: RequestHandler = (_req, _res, next) => next();

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

export const globalLimiter: RequestHandler = IS_TEST
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de requêtes. Veuillez réessayer dans 15 minutes." },
    });

export const authLimiter: RequestHandler = IS_TEST
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de tentatives. Veuillez réessayer dans 15 minutes." },
    });
