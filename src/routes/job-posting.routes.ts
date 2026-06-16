import { Router } from 'express';
import * as jobPostingController from '@/controllers/job-posting.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.get('/', jobPostingController.getAll);
router.get('/:id', jobPostingController.getById);
router.post('/', authenticate, jobPostingController.create);
router.put('/:id', authenticate, jobPostingController.update);
router.delete('/:id', authenticate, jobPostingController.remove);

export default router;
