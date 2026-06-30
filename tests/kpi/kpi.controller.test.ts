import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as kpiController from '@/controllers/kpi.controller';
import { NotFoundError } from '@/errors/index';

const mockFindAll = vi.hoisted(() => vi.fn());
const mockFindById = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock('@/services/kpi.services', () => ({
  findAll: mockFindAll,
  findById: mockFindById,
  create: mockCreate,
  update: mockUpdate,
  remove: mockRemove,
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

const fakeStat = {
  id: 1,
  label: 'KPI 1',
  value: '100',
  position: 1,
  is_active: true,
};

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

describe('kpiController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all stats', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      mockFindAll.mockResolvedValue([fakeStat]);

      await kpiController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith([fakeStat]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the stat when found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(fakeStat);

      await kpiController.getById(req, res, next);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(fakeStat);
    });

    it('calls next with NotFoundError when not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(null);

      kpiController.getById(req, res, next);
      await flush();

      expect(mockFindById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates and returns 201', async () => {
      const req = mockReq({
        body: { label: 'KPI 2', value: '200', position: 2 },
      });
      const res = mockRes();
      const next = vi.fn();

      mockCreate.mockResolvedValue({ id: 2, ...req.body, is_active: true });

      await kpiController.create(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });
  });

  describe('update', () => {
    it('updates and returns the stat', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { label: 'Mis à jour' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue({ ...fakeStat, label: 'Mis à jour' });

      await kpiController.update(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(1, req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ label: 'Mis à jour' }));
    });

    it('calls next with NotFoundError when stat not found', async () => {
      const req = mockReq({ params: { id: '999' }, body: { label: 'Nope' } });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue(null);

      kpiController.update(req, res, next);
      await flush();

      expect(mockUpdate).toHaveBeenCalledWith(999, req.body);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes and returns 204', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockRemove.mockResolvedValue(undefined);

      await kpiController.remove(req, res, next);

      expect(mockRemove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
