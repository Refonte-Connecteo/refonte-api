import { Router } from 'express';
import * as spontaneousApplicationController from '@/controllers/spontaneous-application.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, spontaneousApplicationController.getAll);
router.get('/:id', authenticate, spontaneousApplicationController.getById);
router.post('/', spontaneousApplicationController.create);
router.put('/:id', authenticate, spontaneousApplicationController.update);
router.delete('/:id', authenticate, spontaneousApplicationController.remove);

export default router;
