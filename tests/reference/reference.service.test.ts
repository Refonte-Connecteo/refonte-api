import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as referenceService from '@/services/reference.services';

const mockReference = {
  id: 1,
  name: 'Ref 1',
  logo_url: 'https://example.com/logo.png',
  website_url: 'https://example.com',
  position: 1,
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  reference: {
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

describe('referenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all references ordered by position asc', async () => {
      mockPrisma.reference.findMany.mockResolvedValue([mockReference]);

      const result = await referenceService.findAll();

      expect(result).toEqual([mockReference]);
      expect(mockPrisma.reference.findMany).toHaveBeenCalledWith({
        orderBy: { position: 'asc' },
      });
    });

    it('returns empty array when no references exist', async () => {
      mockPrisma.reference.findMany.mockResolvedValue([]);

      const result = await referenceService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the reference when found', async () => {
      mockPrisma.reference.findUnique.mockResolvedValue(mockReference);

      const result = await referenceService.findById(1);

      expect(result).toEqual(mockReference);
      expect(mockPrisma.reference.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.reference.findUnique.mockResolvedValue(null);

      const result = await referenceService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the reference', async () => {
      const dto = {
        name: 'Ref 2',
        logo_url: 'https://example.com/logo2.png',
        position: 2,
      };

      mockPrisma.reference.create.mockResolvedValue({ id: 2, ...dto, website_url: null, is_active: true });

      const result = await referenceService.create(dto);

      expect(result).toMatchObject({ id: 2, name: dto.name });
      expect(mockPrisma.reference.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the reference', async () => {
      const dto = { name: 'Updated' };
      const updated = { ...mockReference, name: 'Updated' };

      mockPrisma.reference.update.mockResolvedValue(updated);

      const result = await referenceService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.reference.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when reference does not exist', async () => {
      mockPrisma.reference.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(referenceService.update(999, { name: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the reference', async () => {
      mockPrisma.reference.delete.mockResolvedValue(mockReference);

      await referenceService.remove(1);

      expect(mockPrisma.reference.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when reference does not exist', async () => {
      mockPrisma.reference.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(referenceService.remove(999)).rejects.toThrow();
    });
  });
});
