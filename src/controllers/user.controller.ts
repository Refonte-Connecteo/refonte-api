import type { Request, Response } from 'express';
import * as userService from '@/services/user.services';
import { asyncHandler } from '@/lib/async-handler';
import { UnauthorizedError } from '@/errors/index';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new UnauthorizedError('Email et mot de passe requis');
  }

  const { accessToken, refreshToken } = await userService.login(email, password);

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ message: 'Connexion réussie' });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
  res.json({ message: 'Déconnexion réussie' });
});
