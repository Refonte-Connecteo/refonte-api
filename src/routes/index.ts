import { Router } from 'express';
import heroRoutes from './hero.routes';
import kpiRoutes from './kpi.routes';
import jobPostingRoutes from './job-posting.routes';

const router = Router();

router.use('/hero', heroRoutes);
router.use('/kpi', kpiRoutes);
router.use('/job-postings', jobPostingRoutes);

export default router;
