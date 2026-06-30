import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateAdmin } from '@/middlewares/auth.middleware';
import { UnauthorizedError } from '@/errors/index';

vi.mock('@/config/env.config', () => ({
  envConfig: {
    serverConfig: {
      jwtSecret: 'test-secret',
      jwtAccessSecret: 'test-access-secret',
    },
  },
}));

const mockVerify = vi.hoisted(() => vi.fn());
vi.mock('jsonwebtoken', () => ({ default: { verify: mockVerify } }));

vi.mock('@/types/express', () => ({}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('calls next when token is valid', async () => {
      const payload = { userId: 1, userTypeId: 2 };
      mockVerify.mockReturnValue(payload);

      const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.user).toEqual(payload);
      expect(next).toHaveBeenCalledOnce();
    });

    it('throws UnauthorizedError when authorization header is missing', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when token is invalid', async () => {
      mockVerify.mockImplementation(() => { throw new Error('jwt error'); });

      const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('authenticateAdmin', () => {
    it('calls next when token is valid', async () => {
      const payload = { id: '1', email: 'admin@example.com', user_type_id: '1' };
      mockVerify.mockReturnValue(payload);

      const req = mockReq({ cookies: { access_token: 'valid-token' } });
      const res = mockRes();
      const next = vi.fn();

      await authenticateAdmin(req, res, next);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'test-access-secret');
      expect(req.admin).toEqual(payload);
      expect(next).toHaveBeenCalledOnce();
    });

    it('throws UnauthorizedError when cookie is missing', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await authenticateAdmin(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when token is invalid', async () => {
      mockVerify.mockImplementation(() => { throw new Error('jwt error'); });

      const req = mockReq({ cookies: { access_token: 'invalid-token' } });
      const res = mockRes();
      const next = vi.fn();

      await authenticateAdmin(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });
  });
});
