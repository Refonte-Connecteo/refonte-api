import { env } from "../config/env.config.js";
import { logger } from "../lib/logger.js";
import { purgeAuditLogs } from "../services/audit.service.js";

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

let timer: NodeJS.Timeout | null = null;

function nextRunDelay(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function run(): Promise<void> {
  try {
    const { deleted } = await purgeAuditLogs();
    logger.info(
      { deleted, retentionDays: env.AUDIT_RETENTION_DAYS },
      "Purge de la piste d'audit terminée",
    );
  } catch (err) {
    logger.error(err, "Échec de la purge de la piste d'audit");
  } finally {
    scheduleNext();
  }
}

function scheduleNext(): void {
  if (IS_TEST) return;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => void run(), nextRunDelay());
}

/** Démarre la purge quotidienne (première exécution 1 min après le boot, puis à 03:00). */
export function startAuditPurgeJob(): void {
  if (IS_TEST) return;
  if (timer) return;
  timer = setTimeout(() => void run(), 60_000);
}

/** Arrête la planification (utile pour les tests). */
export function stopAuditPurgeJob(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
