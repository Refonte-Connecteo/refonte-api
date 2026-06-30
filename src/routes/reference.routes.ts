import { Router } from 'express';
import * as referenceController from '@/controllers/reference.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', referenceController.getAll);
router.get('/:id', referenceController.getById);
router.post('/', authenticate, referenceController.create);
router.put('/:id', authenticate, referenceController.update);
router.delete('/:id', authenticate, referenceController.remove);

export default router;
