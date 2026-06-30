import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as catalogueController from '@/controllers/catalogue.controller';
import { NotFoundError } from '@/errors/index';

const mockFindAll = vi.hoisted(() => vi.fn());
const mockFindById = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock('@/services/catalogue.services', () => ({
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

const fakeCatalogue = {
  id: 1,
  name: 'Catalogue 1',
  file_url: 'https://example.com/cat.pdf',
  uploaded_at: new Date('2024-01-01'),
};

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

describe('catalogueController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all catalogues', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      mockFindAll.mockResolvedValue([fakeCatalogue]);

      await catalogueController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith([fakeCatalogue]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the catalogue when found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(fakeCatalogue);

      await catalogueController.getById(req, res, next);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(fakeCatalogue);
    });

    it('calls next with NotFoundError when not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(null);

      catalogueController.getById(req, res, next);
      await flush();

      expect(mockFindById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates and returns 201', async () => {
      const req = mockReq({
        body: { name: 'Catalogue 2', file_url: 'https://example.com/cat2.pdf' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockCreate.mockResolvedValue({ id: 2, ...req.body, uploaded_at: new Date() });

      await catalogueController.create(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });
  });

  describe('update', () => {
    it('updates and returns the catalogue', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { name: 'Updated' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue({ ...fakeCatalogue, name: 'Updated' });

      await catalogueController.update(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(1, req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
    });

    it('calls next with NotFoundError when catalogue not found', async () => {
      const req = mockReq({ params: { id: '999' }, body: { name: 'Nope' } });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue(null);

      catalogueController.update(req, res, next);
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

      await catalogueController.remove(req, res, next);

      expect(mockRemove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
