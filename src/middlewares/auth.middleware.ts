import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { envConfig } from '@/config/env.config';
import type { AdminPayload } from '@/types/express';
import { UnauthorizedError } from '@/errors/index';
import { asyncHandler } from '@/lib/async-handler';

export interface JwtPayload {
    userId: number
    userTypeId: number
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload
        }
    }
}

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
        throw new UnauthorizedError('Token manquant');
    }

    const token = header.slice(7);

    try {
        const payload = jwt.verify(token, envConfig.serverConfig.jwtSecret) as JwtPayload;
        req.user = payload;
        next();
    } catch {
        throw new UnauthorizedError('Token invalide ou expiré');
    }
});

export const authenticateAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.access_token;

    if (!token) {
        throw new UnauthorizedError('Accès refusé. Aucun token fourni.');
    }

    try {
        const payload = jwt.verify(token, envConfig.serverConfig.jwtAccessSecret) as AdminPayload;
        req.admin = payload;
        next();
    } catch {
        throw new UnauthorizedError('Session expirée ou token invalide.');
    }
});
