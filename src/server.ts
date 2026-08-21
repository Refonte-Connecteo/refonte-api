import app from './app.js';
import { startAuditPurgeJob } from './jobs/auditPurge.job.js';
import { startOrphanSweepJob } from './jobs/orphanFiles.job.js';

const port = Number(process.env.PORT || 3000);

// Isolement réseau : le serveur n'est jamais exposé directement à Internet.
// Nginx agit en reverse proxy et n'accède à l'API que via le loopback.
// Surcharger HOST (ex: 0.0.0.0) uniquement pour un usage local de debug.
const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
  startAuditPurgeJob();
  startOrphanSweepJob();
});
