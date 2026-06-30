import { Router } from 'express';
import * as catalogueController from '@/controllers/catalogue.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', catalogueController.getAll);
router.get('/:id', catalogueController.getById);
router.post('/', authenticate, catalogueController.create);
router.put('/:id', authenticate, catalogueController.update);
router.delete('/:id', authenticate, catalogueController.remove);

export default router;
