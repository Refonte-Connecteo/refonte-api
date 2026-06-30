import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '@/errors/index';

export const contactRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Trop de tentatives. Veuillez réessayer plus tard.'));
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Trop de requêtes. Limite de 20 requêtes par minute.'));
  },
});
