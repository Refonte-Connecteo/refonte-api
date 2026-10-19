import app from './app.js';
import { env } from './config/env.config.js';
import { startAuditPurgeJob } from './jobs/auditPurge.job.js';
import { startOrphanSweepJob } from './jobs/orphanFiles.job.js';
import { startKeepAliveJob } from './jobs/keepAlive.job.js';

const port = env.PORT;

// Isolement réseau : le serveur n'est jamais exposé directement à Internet.
// Nginx agit en reverse proxy et n'accède à l'API que via le loopback.
// Surcharger HOST (ex: 0.0.0.0) uniquement pour un usage local de debug.
const host = process.env.HOST || "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
  startAuditPurgeJob();
  startOrphanSweepJob();
  startKeepAliveJob();
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[FATAL] Le port ${port} est déjà utilisé (EADDRINUSE).\n` +
        `        Fermez le processus qui l'occupe, ou changez PORT dans back/.env\n` +
        `        (p. ex. PORT=4000). L'API ne peut pas démarrer sur ce port.`,
    );
    process.exit(1);
  }
  console.error("[FATAL] Impossible de démarrer le serveur HTTP :", err);
  process.exit(1);
});
