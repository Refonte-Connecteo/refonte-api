import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import {
  logAuditEvent,
  buildAuditMeta,
  AuditEventType,
} from "../services/audit.service.js";

const noop: RequestHandler = (_req, _res, next) => next();

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

const RATE_LIMIT_MESSAGE = { error: "Trop de requêtes. Veuillez réessayer dans 30 secondes." };

const authLimitMessage = { error: "Trop de tentatives. Veuillez réessayer dans 30 secondes." };

export const globalLimiter: RequestHandler = IS_TEST
  ? noop
  : rateLimit({
      windowMs: 30 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: RATE_LIMIT_MESSAGE,
      handler: (req, res) => {
        void logAuditEvent({
          eventType: AuditEventType.RATE_LIMITED,
          action: "Limite globale de requêtes dépassée",
          success: false,
          statusCode: 429,
          errorCode: "RATE_LIMIT",
          meta: buildAuditMeta(req),
        });
        res.status(429).json(RATE_LIMIT_MESSAGE);
      },
    });

export const authLimiter: RequestHandler = IS_TEST
  ? noop
  : rateLimit({
      windowMs: 30 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: authLimitMessage,
      handler: (req, res) => {
        void logAuditEvent({
          eventType: AuditEventType.RATE_LIMITED,
          action: "Trop de tentatives d'authentification",
          success: false,
          statusCode: 429,
          errorCode: "RATE_LIMIT",
          meta: buildAuditMeta(req),
        });
        res.status(429).json(authLimitMessage);
      },
    });
