import { Router } from 'express';
import * as ceoMessageController from '@/controllers/ceo-message.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', ceoMessageController.getAll);
router.get('/:id', ceoMessageController.getById);
router.post('/', authenticate, ceoMessageController.create);
router.put('/:id', authenticate, ceoMessageController.update);
router.delete('/:id', authenticate, ceoMessageController.remove);

export default router;
