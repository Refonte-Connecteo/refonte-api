import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serviceService from '@/services/service.services';

const mockService = {
  id: 1,
  title: 'Service 1',
  description: 'Description',
  icon: 'icon-class',
  file_url: 'https://bucket.s3.region.amazonaws.com/catalogues/service-1-123.pdf',
  position: 1,
  is_active: true,
  sectors: [],
};

const mockPrisma = vi.hoisted(() => ({
  service: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockS3 = vi.hoisted(() => ({
  uploadToS3: vi.fn(),
  deleteFromS3: vi.fn(),
  buildS3Key: vi.fn(),
  extractS3Key: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/config/s3', () => mockS3);

beforeEach(() => {
  mockS3.deleteFromS3.mockResolvedValue(undefined);
});

describe('serviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all services with sectors included', async () => {
      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const result = await serviceService.findAll();

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        orderBy: { position: 'asc' },
        include: { sectors: { orderBy: { position: 'asc' } } },
      });
    });
  });

  describe('findById', () => {
    it('returns service when found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(mockService);

      const result = await serviceService.findById(1);

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { sectors: { orderBy: { position: 'asc' } } },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await serviceService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates without file', async () => {
      const dto = { title: 'Service 1', icon: 'icon', position: 1 };
      mockPrisma.service.create.mockResolvedValue({
        id: 2,
        ...dto,
        description: null,
        file_url: null,
        is_active: true,
        sectors: [],
      });

      const result = await serviceService.create(dto);

      expect(result).toMatchObject({ id: 2, title: 'Service 1' });
      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: { ...dto, file_url: undefined },
        include: { sectors: true },
      });
      expect(mockS3.buildS3Key).not.toHaveBeenCalled();
      expect(mockS3.uploadToS3).not.toHaveBeenCalled();
    });

    it('creates with file and uploads to S3', async () => {
      const dto = { title: 'Service PDF' };
      const fakeFile = { buffer: Buffer.from('fake'), originalname: 'doc.pdf', mimetype: 'application/pdf' } as Express.Multer.File;
      const mockKey = 'catalogues/service-0-123456789.pdf';
      const mockUrl = `https://bucket.s3.region.amazonaws.com/${mockKey}`;

      mockS3.buildS3Key.mockReturnValue(mockKey);
      mockS3.uploadToS3.mockResolvedValue(mockUrl);
      mockPrisma.service.create.mockResolvedValue({
        id: 3,
        ...dto,
        file_url: mockUrl,
        description: null,
        icon: null,
        position: null,
        is_active: true,
        sectors: [],
      });

      const result = await serviceService.create(dto, fakeFile);

      expect(mockS3.buildS3Key).toHaveBeenCalledWith(0, fakeFile.originalname);
      expect(mockS3.uploadToS3).toHaveBeenCalledWith(fakeFile.buffer, mockKey, fakeFile.mimetype);
      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: { ...dto, file_url: mockUrl },
        include: { sectors: true },
      });
      expect(result.file_url).toBe(mockUrl);
    });
  });

  describe('update', () => {
    it('returns null when service does not exist', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await serviceService.update(999, { title: 'Nope' });

      expect(result).toBeNull();
      expect(mockPrisma.service.update).not.toHaveBeenCalled();
    });

    it('updates without file', async () => {
      const dto = { title: 'Updated' };
      const updated = { ...mockService, title: 'Updated' };

      mockPrisma.service.findUnique.mockResolvedValue(mockService);
      mockPrisma.service.update.mockResolvedValue(updated);

      const result = await serviceService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
        include: { sectors: true },
      });
      expect(mockS3.deleteFromS3).not.toHaveBeenCalled();
      expect(mockS3.uploadToS3).not.toHaveBeenCalled();
    });

    it('updates with file, deletes old file, uploads new', async () => {
      const dto = { title: 'With File' };
      const fakeFile = { buffer: Buffer.from('new'), originalname: 'new.pdf', mimetype: 'application/pdf' } as Express.Multer.File;
      const existing = { ...mockService, file_url: 'https://bucket.s3.region.amazonaws.com/catalogues/old-file.pdf' };
      const oldKey = 'catalogues/old-file.pdf';
      const newKey = 'catalogues/service-1-987654321.pdf';
      const newUrl = `https://bucket.s3.region.amazonaws.com/${newKey}`;

      mockPrisma.service.findUnique.mockResolvedValue(existing);
      mockS3.extractS3Key.mockReturnValue(oldKey);
      mockS3.buildS3Key.mockReturnValue(newKey);
      mockS3.uploadToS3.mockResolvedValue(newUrl);
      mockPrisma.service.update.mockResolvedValue({ ...existing, ...dto, file_url: newUrl });

      const result = await serviceService.update(1, dto, fakeFile);

      expect(mockS3.extractS3Key).toHaveBeenCalledWith(existing.file_url);
      expect(mockS3.deleteFromS3).toHaveBeenCalledWith(oldKey);
      expect(mockS3.buildS3Key).toHaveBeenCalledWith(1, fakeFile.originalname);
      expect(mockS3.uploadToS3).toHaveBeenCalledWith(fakeFile.buffer, newKey, fakeFile.mimetype);
      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { ...dto, file_url: newUrl },
        include: { sectors: true },
      });
      expect(result.file_url).toBe(newUrl);
    });
  });

  describe('remove', () => {
    it('returns null when service does not exist', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await serviceService.remove(999);

      expect(result).toBeNull();
      expect(mockPrisma.service.delete).not.toHaveBeenCalled();
    });

    it('deletes service without file_url', async () => {
      const existing = { ...mockService, file_url: null };

      mockPrisma.service.findUnique.mockResolvedValue(existing);
      mockPrisma.service.delete.mockResolvedValue(existing);

      const result = await serviceService.remove(1);

      expect(result).toEqual(existing);
      expect(mockPrisma.service.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockS3.deleteFromS3).not.toHaveBeenCalled();
    });

    it('deletes service with file_url and removes from S3', async () => {
      const existing = { ...mockService };
      const key = 'catalogues/service-1-123.pdf';

      mockPrisma.service.findUnique.mockResolvedValue(existing);
      mockS3.extractS3Key.mockReturnValue(key);
      mockPrisma.service.delete.mockResolvedValue(existing);

      const result = await serviceService.remove(1);

      expect(mockS3.extractS3Key).toHaveBeenCalledWith(existing.file_url);
      expect(mockS3.deleteFromS3).toHaveBeenCalledWith(key);
      expect(mockPrisma.service.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(existing);
    });
  });
});
