import { Router } from 'express';
import * as eventController from '@/controllers/event.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);
router.post('/', authenticate, eventController.create);
router.put('/:id', authenticate, eventController.update);
router.delete('/:id', authenticate, eventController.remove);

export default router;
