import { Router } from 'express';
import * as kpiController from '@/controllers/kpi.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', kpiController.getAll);
router.get('/:id', kpiController.getById);
router.post('/', authenticate, kpiController.create);
router.put('/:id', authenticate, kpiController.update);
router.delete('/:id', authenticate, kpiController.remove);

export default router;
