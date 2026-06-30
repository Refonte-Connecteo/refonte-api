import { Router } from 'express';
import heroRoutes from './hero.routes';
import kpiRoutes from './kpi.routes';
import jobPostingRoutes from './job-posting.routes';
import articleRoutes from './article.routes';
import eventRoutes from './event.routes';
import applicationRoutes from './application.routes';
import spontaneousApplicationRoutes from './spontaneous-application.routes';
import serviceRoutes from './service.routes';
import authRoutes from './auth.routes';
import contactRoutes from './contact.routes';
import ceoMessageRoutes from './ceo-message.routes';
import referenceRoutes from './reference.routes';
import catalogueRoutes from './catalogue.routes';
import chatRoutes from './chat.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hero', heroRoutes);
router.use('/kpi', kpiRoutes);
router.use('/job-postings', jobPostingRoutes);
router.use('/articles', articleRoutes);
router.use('/events', eventRoutes);
router.use('/applications', applicationRoutes);
router.use('/spontaneous-applications', spontaneousApplicationRoutes);
router.use('/services', serviceRoutes);
router.use('/contact', contactRoutes);
router.use('/ceo-message', ceoMessageRoutes);
router.use('/references', referenceRoutes);
router.use('/catalogues', catalogueRoutes);
router.use('/chat', chatRoutes);

export default router;
