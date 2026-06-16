import { Router } from 'express';
import heroRoutes from './hero.routes';
import kpiRoutes from './kpi.routes';

const router = Router();

router.use('/hero', heroRoutes);
router.use('/kpi', kpiRoutes);

export default router;
