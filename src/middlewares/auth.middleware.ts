import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.config.js";
import { logger } from "../lib/logger.js";
import prisma from "../lib/prisma.js";
import { UnauthorizedError, ForbiddenError, BadRequestError } from "../errors/index.js";
import { isTokenRevoked } from "../services/token.service.js";
import {
  logAuditEvent,
  buildAuditMeta,
  AuditEventType,
} from "../services/audit.service.js";
import type { JwtPayload } from "../services/user.services.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    logger.warn({ ip: req.ip }, "Tentative d'accès sans token");
    void logAuditEvent({
      eventType: AuditEventType.AUTH_FAILED,
      action: "Accès sans token",
      success: false,
      statusCode: 401,
      errorCode: "UNAUTHORIZED",
      meta: buildAuditMeta(req),
    });
    const err = new UnauthorizedError("Token manquant ou invalide");
    (err as UnauthorizedError & { auditLogged?: boolean }).auditLogged = true;
    next(err);
    return;
  }

  const token = header.split(" ")[1];

  let decoded: JwtPayload & { isMfaPending?: boolean };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM],
    }) as unknown as JwtPayload & { isMfaPending?: boolean };
  } catch {
    logger.warn({ ip: req.ip }, "Tentative d'accès avec token invalide");
    void logAuditEvent({
      eventType: AuditEventType.AUTH_FAILED,
      action: "Accès avec token invalide",
      success: false,
      statusCode: 401,
      errorCode: "INVALID_TOKEN",
      meta: buildAuditMeta(req),
    });
    const err = new UnauthorizedError("Token invalide ou expiré");
    (err as UnauthorizedError & { auditLogged?: boolean }).auditLogged = true;
    next(err);
    return;
  }

  if (decoded.isMfaPending) {
    next(new UnauthorizedError("Le MFA doit être validé pour accéder à cette ressource"));
    return;
  }

  if (decoded.tokenType !== "access") {
    next(new UnauthorizedError("Token invalide ou expiré"));
    return;
  }

  isTokenRevoked(token)
    .then(async (revoked) => {
      if (revoked) {
        throw new UnauthorizedError("Token révoqué");
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

      if (!user || !user.is_active) {
        throw new UnauthorizedError("Compte inactif ou introuvable");
      }

      if (user.token_version !== decoded.tokenVersion) {
        throw new UnauthorizedError("Token révoqué");
      }

      req.user = decoded;
      next();
    })
    .catch(next);
}

export function requireReauthentication(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError("Non authentifié"));
    return;
  }

  const { currentPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || !currentPassword) {
    next(new BadRequestError("Le mot de passe actuel (currentPassword) est requis"));
    return;
  }

  prisma.user
    .findUnique({ where: { id: req.user.userId } })
    .then(async (user) => {
      if (!user?.password_hash) {
        throw new UnauthorizedError("Le mot de passe actuel est incorrect");
      }

      const isValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValid) {
        throw new UnauthorizedError("Le mot de passe actuel est incorrect");
      }

      next();
    })
    .catch(next);
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError("Non authentifié");
  }

  if (req.user.userTypeId !== 1) {
    throw new ForbiddenError("Accès réservé au super administrateur");
  }

  void logAuditEvent({
    eventType: AuditEventType.PRIVILEGED_REQUEST,
    action: "Requête superAdmin",
    success: true,
    actorUserId: req.user.userId,
    actorEmail: req.user.email,
    meta: buildAuditMeta(req),
  });

  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError("Non authentifié");
  }

  if (req.user.userTypeId !== 1 && req.user.userTypeId !== 2) {
    throw new ForbiddenError("Accès réservé aux administrateurs");
  }

  void logAuditEvent({
    eventType: AuditEventType.PRIVILEGED_REQUEST,
    action: "Requête admin",
    success: true,
    actorUserId: req.user.userId,
    actorEmail: req.user.email,
    meta: buildAuditMeta(req),
  });

  next();
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
