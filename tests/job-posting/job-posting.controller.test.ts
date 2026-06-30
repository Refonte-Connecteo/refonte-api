import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as jobPostingController from '@/controllers/job-posting.controller';
import { NotFoundError } from '@/errors/index';

const mockFindAll = vi.hoisted(() => vi.fn());
const mockFindById = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock('@/services/job-posting.services', () => ({
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

const fakePosting = {
  id: 1,
  title: 'Développeur',
  description: 'Description',
  location: 'Paris',
  type: 'CDI',
  created_at: new Date('2024-01-01'),
  is_active: true,
};

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

describe('jobPostingController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all postings', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      mockFindAll.mockResolvedValue([fakePosting]);

      await jobPostingController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith([fakePosting]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the posting when found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(fakePosting);

      await jobPostingController.getById(req, res, next);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(fakePosting);
    });

    it('calls next with NotFoundError when not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(null);

      jobPostingController.getById(req, res, next);
      await flush();

      expect(mockFindById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates and returns 201', async () => {
      const req = mockReq({
        body: { title: 'Nouveau poste', description: 'Desc', location: 'Lyon', type: 'CDD' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockCreate.mockResolvedValue({ id: 2, ...req.body, created_at: new Date(), is_active: true });

      await jobPostingController.create(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });
  });

  describe('update', () => {
    it('updates and returns the posting', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { title: 'Mis à jour' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue({ ...fakePosting, title: 'Mis à jour' });

      await jobPostingController.update(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(1, req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mis à jour' }));
    });
  });

  describe('remove', () => {
    it('deletes and returns 204', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockRemove.mockResolvedValue(undefined);

      await jobPostingController.remove(req, res, next);

      expect(mockRemove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
