import { Router } from 'express';
import * as heroController from '@/controllers/hero.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', heroController.getAll);
router.get('/:id', heroController.getById);
router.post('/', authenticate, heroController.create);
router.put('/:id', authenticate, heroController.update);
router.delete('/:id', authenticate, heroController.remove);

export default router;
