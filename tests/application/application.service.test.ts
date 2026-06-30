import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as applicationService from '@/services/application.services';

const mockApplication = {
  id: 1,
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  submitted_at: new Date('2024-01-01'),
  job_posting: { id: 1, title: 'Dev' },
};

const mockPrisma = vi.hoisted(() => ({
  application: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}));

describe('applicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all applications ordered by submitted_at desc', async () => {
      mockPrisma.application.findMany.mockResolvedValue([mockApplication]);

      const result = await applicationService.findAll();

      expect(result).toEqual([mockApplication]);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        orderBy: { submitted_at: 'desc' },
        include: { job_posting: true },
      });
    });

    it('returns empty array when no applications exist', async () => {
      mockPrisma.application.findMany.mockResolvedValue([]);

      const result = await applicationService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the application when found', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(mockApplication);

      const result = await applicationService.findById(1);

      expect(result).toEqual(mockApplication);
      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { job_posting: true },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);

      const result = await applicationService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the application', async () => {
      const dto = {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      };

      mockPrisma.application.create.mockResolvedValue({ id: 2, ...dto, submitted_at: new Date() });

      const result = await applicationService.create(dto);

      expect(result).toMatchObject({ id: 2, first_name: dto.first_name });
      expect(mockPrisma.application.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the application', async () => {
      const dto = { first_name: 'Updated' };
      const updated = { ...mockApplication, first_name: 'Updated' };

      mockPrisma.application.update.mockResolvedValue(updated);

      const result = await applicationService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when application does not exist', async () => {
      mockPrisma.application.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(applicationService.update(999, { first_name: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the application', async () => {
      mockPrisma.application.delete.mockResolvedValue(mockApplication);

      await applicationService.remove(1);

      expect(mockPrisma.application.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when application does not exist', async () => {
      mockPrisma.application.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(applicationService.remove(999)).rejects.toThrow();
    });
  });
});
