import "dotenv/config";
import { runDataPurge } from "../src/services/purge.service.js";
import { logger } from "../src/lib/logger.js";

/**
 * CLI de purge des données expirées (politique de rétention RGPD).
 *
 * Exécution manuelle :  npm run purge-data
 * Planification cron  :  30 2 * * * cd /srv/refonte-api && npm run purge-data >> /var/log/refonte-api/purge.log 2>&1
 *
 * Cible :
 * - candidatures + CV associés de plus de 24 mois (APPLICATION_RETENTION_MONTHS) ;
 * - messages de contact de plus de 12 mois (CONTACT_MESSAGE_RETENTION_MONTHS) ;
 * - tokens révoqués expirés ;
 * - vues pages anonymisées de plus de 13 mois (PAGE_VIEW_RETENTION_DAYS).
 */
async function main(): Promise<void> {
  try {
    const summary = await runDataPurge();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(0);
  } catch (err) {
    logger.error(err, "Échec de la purge des données expirées");
    process.exit(1);
  }
}

void main();
