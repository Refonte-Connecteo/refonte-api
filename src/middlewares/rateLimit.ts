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

const uploadLimitMessage = {
  error: "Trop d'uploads. Veuillez réessayer dans quelques minutes.",
};

/**
 * Limiteur dédié aux uploads de CV publics (par IP).
 * En environnement de test, la limite est élargie pour ne pas fausser les
 * autres tests ; des valeurs explicites peuvent être passées en argument.
 */
export function createUploadCvLimiter(options?: {
  windowMs?: number;
  max?: number;
}): RequestHandler {
  const defaults = IS_TEST
    ? { windowMs: 60 * 1000, max: 10 }
    : { windowMs: 15 * 60 * 1000, max: 5 };

  const { windowMs, max } = { ...defaults, ...options };

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: uploadLimitMessage,
    handler: (req, res) => {
      void logAuditEvent({
        eventType: AuditEventType.RATE_LIMITED,
        action: "Limite d'upload de CV dépassée",
        success: false,
        statusCode: 429,
        errorCode: "RATE_LIMIT",
        meta: buildAuditMeta(req),
      });
      res.status(429).json(uploadLimitMessage);
    },
  });
}

export const uploadCvLimiter: RequestHandler = createUploadCvLimiter();

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
