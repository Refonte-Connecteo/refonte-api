import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as authController from '@/controllers/user.controller';
import { UnauthorizedError } from '@/errors/index';

const mockLogin = vi.hoisted(() => vi.fn());

vi.mock('@/services/user.services', () => ({
  login: mockLogin,
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    headers: {},
    cookies: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('sets cookies and returns success message', async () => {
      const req = mockReq({
        body: { email: 'admin@example.com', password: 'password123' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockLogin.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

      await authController.login(req, res, next);

      expect(mockLogin).toHaveBeenCalledWith('admin@example.com', 'password123');
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      expect(res.json).toHaveBeenCalledWith({ message: 'Connexion réussie' });
      expect(next).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when email is missing', async () => {
      const req = mockReq({ body: { password: 'password123' } });
      const res = mockRes();
      const next = vi.fn();

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when password is missing', async () => {
      const req = mockReq({ body: { email: 'admin@example.com' } });
      const res = mockRes();
      const next = vi.fn();

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('logout', () => {
    it('clears cookies and returns success message', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await authController.logout(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ message: 'Déconnexion réussie' });
    });
  });
});
