import { Router } from 'express';
import * as articleController from '@/controllers/article.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', articleController.getAll);
router.get('/:id', articleController.getById);
router.post('/', authenticate, articleController.create);
router.put('/:id', authenticate, articleController.update);
router.delete('/:id', authenticate, articleController.remove);

export default router;
