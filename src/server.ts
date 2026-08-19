import app from './app.js';
import { startAuditPurgeJob } from './jobs/auditPurge.job.js';
import { startOrphanSweepJob } from './jobs/orphanFiles.job.js';
import { startKeepAliveJob } from './jobs/keepAlive.job.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  startAuditPurgeJob();
  startOrphanSweepJob();
  startKeepAliveJob();
});
