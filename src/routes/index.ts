import { Router } from 'express';
import heroRoutes from './hero.routes';
import kpiRoutes from './kpi.routes';
import jobPostingRoutes from './job-posting.routes';
import articleRoutes from './article.routes';
import eventRoutes from './event.routes';
import applicationRoutes from './application.routes';
import spontaneousApplicationRoutes from './spontaneous-application.routes';

const router = Router();

router.use('/hero', heroRoutes);
router.use('/kpi', kpiRoutes);
router.use('/job-postings', jobPostingRoutes);
router.use('/articles', articleRoutes);
router.use('/events', eventRoutes);
router.use('/applications', applicationRoutes);
router.use('/spontaneous-applications', spontaneousApplicationRoutes);

export default router;
