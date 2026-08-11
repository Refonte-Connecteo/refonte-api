import type { Request } from "express";
import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.config.js";

export const AuditEventType = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  MFA_SETUP: "MFA_SETUP",
  MFA_SETUP_FAILED: "MFA_SETUP_FAILED",
  MFA_VERIFY_SUCCESS: "MFA_VERIFY_SUCCESS",
  MFA_VERIFY_FAILED: "MFA_VERIFY_FAILED",
  MFA_DISABLED: "MFA_DISABLED",
  PASSWORD_SET: "PASSWORD_SET",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ADMIN_INVITED: "ADMIN_INVITED",
  ADMIN_DEACTIVATED: "ADMIN_DEACTIVATED",
  ADMIN_DELETED: "ADMIN_DELETED",
  ADMIN_LISTED: "ADMIN_LISTED",
  PRIVILEGED_REQUEST: "PRIVILEGED_REQUEST",
  LOGOUT: "LOGOUT",
  TOKEN_REFRESH: "TOKEN_REFRESH",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  AUTH_FAILED: "AUTH_FAILED",
  VALIDATION_REJECTED: "VALIDATION_REJECTED",
  RATE_LIMITED: "RATE_LIMITED",
  PATH_TRAVERSAL_BLOCKED: "PATH_TRAVERSAL_BLOCKED",
  ERROR: "ERROR",
} as const;

export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

/** Contexte transport de la requête HTTP à rattacher à l'événement. */
export interface AuditMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  method?: string;
  route?: string;
}

export interface AuditEventInput {
  eventType: AuditEventType;
  action: string;
  success: boolean;
  actorUserId?: number | null;
  actorEmail?: string | null;
  resourceType?: string;
  resourceId?: string;
  statusCode?: number;
  errorCode?: string;
  details?: Record<string, unknown> | null;
  meta?: AuditMeta | null;
}

const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "jwt",
  "code",
  "mfa",
  "otp",
];

/** Masque défensivement toute valeur sensible dans les détails de l'événement. */
function scrubObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubObject);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        const isSensitive = SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
          key.toLowerCase().includes(fragment),
        );
        return [key, isSensitive ? "[REDACTED]" : scrubObject(val)];
      }),
    );
  }

  return value;
}

/** Construit le contexte transport à partir d'une requête Express. */
export function buildAuditMeta(req: Request): AuditMeta {
  return {
    ip: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    requestId: (req as Request & { id?: string }).id ?? null,
    method: req.method,
    route: req.originalUrl?.split("?")[0] ?? req.baseUrl ?? null,
  };
}

/** Code d'erreur normalisé à partir d'une exception AppError quelconque. */
export function errorCodeFrom(err: unknown, fallback = "UNKNOWN"): string {
  if (err instanceof Error) {
    return err.name.toUpperCase().replace(/\s+/g, "_") || fallback;
  }
  return fallback;
}

/**
 * Journalise un événement de sécurité dans la piste d'audit (append-only).
 * Ne lève jamais d'exception : un échec d'écriture est seulement loggé,
 * afin de ne jamais casser une requête en cours.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.audit_log.create({
      data: {
        event_type: input.eventType,
        action: input.action,
        actor_user_id: input.actorUserId ?? null,
        actor_email: input.actorEmail ?? null,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        success: input.success,
        status_code: input.statusCode ?? null,
        error_code: input.errorCode ?? null,
        ip: input.meta?.ip ?? null,
        user_agent: input.meta?.userAgent ?? null,
        request_id: input.meta?.requestId ?? null,
        method: input.meta?.method ?? null,
        route: input.meta?.route ?? null,
        details:
          input.details && Object.keys(input.details).length > 0
            ? (scrubObject(input.details) as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, event: input.eventType }, "Échec d'écriture de l'événement d'audit");
  }
}

/** Version fire-and-forget : n'attend pas la fin de l'écriture. */
export function emitAuditEvent(input: AuditEventInput): void {
  void logAuditEvent(input);
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  eventType?: string;
  success?: boolean;
  email?: string;
  from?: string;
  to?: string;
}

export interface AuditLogPage {
  logs: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

/** Consultation paginée et filtrée de la piste d'audit (réservée superAdmin). */
export async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

  const where: Prisma.audit_logWhereInput = {};

  if (query.eventType) {
    where.event_type = query.eventType;
  }
  if (typeof query.success === "boolean") {
    where.success = query.success;
  }
  if (query.email) {
    where.actor_email = { contains: query.email, mode: "insensitive" };
  }

  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (from || to) {
    where.created_at = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.audit_log.count({ where }),
    prisma.audit_log.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { logs, total, page, pageSize };
}

/** Purge les journaux plus vieux que la rétention configurée (jours). Best-effort. */
export async function purgeAuditLogs(retentionDays?: number): Promise<{ deleted: number }> {
  const days = retentionDays ?? env.AUDIT_RETENTION_DAYS;
  if (!Number.isFinite(days) || days <= 0) {
    return { deleted: 0 };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.audit_log.deleteMany({
    where: { created_at: { lt: cutoff } },
  });
  return { deleted: result.count };
}
