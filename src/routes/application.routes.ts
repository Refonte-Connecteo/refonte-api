import { Router } from 'express';
import * as applicationController from '@/controllers/application.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, applicationController.getAll);
router.get('/:id', authenticate, applicationController.getById);
router.post('/', applicationController.create);
router.put('/:id', authenticate, applicationController.update);
router.delete('/:id', authenticate, applicationController.remove);

export default router;
