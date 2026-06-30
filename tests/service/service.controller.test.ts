import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as serviceController from '@/controllers/service.controller';
import { NotFoundError } from '@/errors/index';

const mockServiceService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

const mockSectorService = vi.hoisted(() => ({
  findAllByService: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/services/service.services', () => mockServiceService);
vi.mock('@/services/sector.services', () => mockSectorService);

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

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

const fakeService = {
  id: 1,
  title: 'Service 1',
  description: 'Description',
  icon: 'icon-class',
  file_url: null,
  position: 1,
  is_active: true,
  sectors: [],
};

const fakeSector = {
  id: 1,
  service_id: 1,
  title: 'Sector 1',
  description: 'Desc',
  icon: 'icon',
  position: 1,
  is_active: true,
};

describe('serviceController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all services', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findAll.mockResolvedValue([fakeService]);

      await serviceController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith([fakeService]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns service when found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(fakeService);

      await serviceController.getById(req, res, next);

      expect(mockServiceService.findById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(fakeService);
    });

    it('calls next with NotFoundError when not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(null);

      serviceController.getById(req, res, next);
      await flush();

      expect(mockServiceService.findById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates and returns 201', async () => {
      const req = mockReq({
        body: { title: 'Service 1', icon: 'icon', position: 1, is_active: true },
      });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.create.mockResolvedValue({
        id: 2,
        ...req.body,
        description: null,
        file_url: null,
        sectors: [],
      });

      await serviceController.create(req, res, next);

      expect(mockServiceService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Service 1' }),
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });
  });

  describe('update', () => {
    it('updates and returns the service', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { title: 'Updated' },
      });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.update.mockResolvedValue({ ...fakeService, title: 'Updated' });

      await serviceController.update(req, res, next);

      expect(mockServiceService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Updated' }),
        undefined,
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
    });

    it('calls next with NotFoundError when service not found', async () => {
      const req = mockReq({ params: { id: '999' }, body: { title: 'Nope' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.update.mockResolvedValue(null);

      serviceController.update(req, res, next);
      await flush();

      expect(mockServiceService.update).toHaveBeenCalledWith(
        999,
        expect.anything(),
        undefined,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes and returns 204', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.remove.mockResolvedValue(fakeService);

      await serviceController.remove(req, res, next);

      expect(mockServiceService.remove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls next with NotFoundError when service not found', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.remove.mockResolvedValue(null);

      serviceController.remove(req, res, next);
      await flush();

      expect(mockServiceService.remove).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('getSectors', () => {
    it('returns sectors when service exists', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(fakeService);
      mockSectorService.findAllByService.mockResolvedValue([fakeSector]);

      serviceController.getSectors(req, res, next);
      await flush();

      expect(mockServiceService.findById).toHaveBeenCalledWith(1);
      expect(mockSectorService.findAllByService).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith([fakeSector]);
    });

    it('calls next with NotFoundError when service does not exist', async () => {
      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(null);

      serviceController.getSectors(req, res, next);
      await flush();

      expect(mockServiceService.findById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('createSector', () => {
    it('creates sector under service and returns 201', async () => {
      const req = mockReq({
        params: { id: '1' },
        body: { title: 'New Sector', position: 1 },
      });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(fakeService);
      mockSectorService.create.mockResolvedValue({
        id: 2,
        ...req.body,
        service_id: 1,
        description: null,
        icon: null,
        is_active: true,
      });

      serviceController.createSector(req, res, next);
      await flush();

      expect(mockServiceService.findById).toHaveBeenCalledWith(1);
      expect(mockSectorService.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'New Sector' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });

    it('calls next with NotFoundError when service does not exist', async () => {
      const req = mockReq({ params: { id: '999' }, body: { title: 'Nope' } });
      const res = mockRes();
      const next = vi.fn();

      mockServiceService.findById.mockResolvedValue(null);

      serviceController.createSector(req, res, next);
      await flush();

      expect(mockServiceService.findById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateSector', () => {
    it('updates sector when found', async () => {
      const req = mockReq({ params: { sectorId: '1' }, body: { title: 'Updated Sector' } });
      const res = mockRes();
      const next = vi.fn();

      mockSectorService.findById.mockResolvedValue(fakeSector);
      mockSectorService.update.mockResolvedValue({ ...fakeSector, title: 'Updated Sector' });

      serviceController.updateSector(req, res, next);
      await flush();

      expect(mockSectorService.findById).toHaveBeenCalledWith(1);
      expect(mockSectorService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Updated Sector' }),
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Sector' }));
    });

    it('calls next with NotFoundError when sector does not exist', async () => {
      const req = mockReq({ params: { sectorId: '999' }, body: { title: 'Nope' } });
      const res = mockRes();
      const next = vi.fn();

      mockSectorService.findById.mockResolvedValue(null);

      serviceController.updateSector(req, res, next);
      await flush();

      expect(mockSectorService.findById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('removeSector', () => {
    it('deletes sector and returns 204', async () => {
      const req = mockReq({ params: { sectorId: '1' } });
      const res = mockRes();
      const next = vi.fn();

      mockSectorService.findById.mockResolvedValue(fakeSector);
      mockSectorService.remove.mockResolvedValue(undefined);

      serviceController.removeSector(req, res, next);
      await flush();

      expect(mockSectorService.findById).toHaveBeenCalledWith(1);
      expect(mockSectorService.remove).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls next with NotFoundError when sector does not exist', async () => {
      const req = mockReq({ params: { sectorId: '999' } });
      const res = mockRes();
      const next = vi.fn();

      mockSectorService.findById.mockResolvedValue(null);

      serviceController.removeSector(req, res, next);
      await flush();

      expect(mockSectorService.findById).toHaveBeenCalledWith(999);
      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });
});
