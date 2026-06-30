import { Router } from 'express';
import { handleChat } from '@/controllers/chat.controller';
import { chatRateLimiter } from '@/middlewares/rateLimiter.middleware';

const router = Router();

router.post('/', chatRateLimiter, handleChat);

export default router;
