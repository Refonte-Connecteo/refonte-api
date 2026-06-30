import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as eventController from '@/controllers/event.controller';
import { NotFoundError } from '@/errors/index';

const mockFindAll = vi.hoisted(() => vi.fn());
const mockFindById = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock('@/services/event.services', () => ({
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

const fakeEvent = {
  id: 1,
  title: 'Event 1',
  description: 'Desc',
  event_date: new Date('2024-06-15'),
  location: 'Paris',
  is_active: true,
  event_images: [],
};

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

describe('eventController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all events', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      mockFindAll.mockResolvedValue([fakeEvent]);

      await eventController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith([fakeEvent]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the event when found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(fakeEvent);

      await eventController.getById(req, res, next);

      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(fakeEvent);
    });

    it('calls next with NotFoundError when not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockFindById.mockResolvedValue(null);

      eventController.getById(req, res, next);
      await flush();

      expect(mockFindById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates and returns 201', async () => {
      const req = mockReq({
        body: { title: 'Event 2', description: 'Desc', event_date: '2024-06-15', location: 'Lyon' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockCreate.mockResolvedValue({ id: 2, ...req.body, event_date: new Date('2024-06-15'), is_active: true });

      await eventController.create(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });
  });

  describe('update', () => {
    it('updates and returns the event', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { title: 'Mis à jour' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockUpdate.mockResolvedValue({ ...fakeEvent, title: 'Mis à jour' });

      await eventController.update(req, res, next);

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

      await eventController.remove(req, res, next);

      expect(mockRemove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
