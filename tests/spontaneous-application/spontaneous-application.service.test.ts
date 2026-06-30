import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as spontaneousApplicationService from '@/services/spontaneous-application.services';

const mockSpontaneousApplication = {
  id: 1,
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  message: 'Hello',
  submitted_at: new Date('2024-01-01'),
};

const mockPrisma = vi.hoisted(() => ({
  spontaneous_application: {
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

describe('spontaneousApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all applications ordered by submitted_at desc', async () => {
      mockPrisma.spontaneous_application.findMany.mockResolvedValue([mockSpontaneousApplication]);

      const result = await spontaneousApplicationService.findAll();

      expect(result).toEqual([mockSpontaneousApplication]);
      expect(mockPrisma.spontaneous_application.findMany).toHaveBeenCalledWith({
        orderBy: { submitted_at: 'desc' },
      });
    });

    it('returns empty array when no applications exist', async () => {
      mockPrisma.spontaneous_application.findMany.mockResolvedValue([]);

      const result = await spontaneousApplicationService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the application when found', async () => {
      mockPrisma.spontaneous_application.findUnique.mockResolvedValue(mockSpontaneousApplication);

      const result = await spontaneousApplicationService.findById(1);

      expect(result).toEqual(mockSpontaneousApplication);
      expect(mockPrisma.spontaneous_application.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.spontaneous_application.findUnique.mockResolvedValue(null);

      const result = await spontaneousApplicationService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the application', async () => {
      const dto = {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        message: 'Hi',
      };

      mockPrisma.spontaneous_application.create.mockResolvedValue({ id: 2, ...dto, submitted_at: new Date() });

      const result = await spontaneousApplicationService.create(dto);

      expect(result).toMatchObject({ id: 2, first_name: dto.first_name });
      expect(mockPrisma.spontaneous_application.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the application', async () => {
      const dto = { message: 'Updated' };
      const updated = { ...mockSpontaneousApplication, message: 'Updated' };

      mockPrisma.spontaneous_application.update.mockResolvedValue(updated);

      const result = await spontaneousApplicationService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.spontaneous_application.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when application does not exist', async () => {
      mockPrisma.spontaneous_application.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(spontaneousApplicationService.update(999, { message: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the application', async () => {
      mockPrisma.spontaneous_application.delete.mockResolvedValue(mockSpontaneousApplication);

      await spontaneousApplicationService.remove(1);

      expect(mockPrisma.spontaneous_application.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when application does not exist', async () => {
      mockPrisma.spontaneous_application.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(spontaneousApplicationService.remove(999)).rejects.toThrow();
    });
  });
});
