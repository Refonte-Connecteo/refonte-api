import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as catalogueService from '@/services/catalogue.services';

const mockCatalogue = {
  id: 1,
  name: 'Catalogue 1',
  file_url: 'https://example.com/cat.pdf',
  uploaded_at: new Date('2024-01-01'),
};

const mockPrisma = vi.hoisted(() => ({
  catalogue: {
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

describe('catalogueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all catalogues ordered by uploaded_at desc', async () => {
      mockPrisma.catalogue.findMany.mockResolvedValue([mockCatalogue]);

      const result = await catalogueService.findAll();

      expect(result).toEqual([mockCatalogue]);
      expect(mockPrisma.catalogue.findMany).toHaveBeenCalledWith({
        orderBy: { uploaded_at: 'desc' },
      });
    });

    it('returns empty array when no catalogues exist', async () => {
      mockPrisma.catalogue.findMany.mockResolvedValue([]);

      const result = await catalogueService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the catalogue when found', async () => {
      mockPrisma.catalogue.findUnique.mockResolvedValue(mockCatalogue);

      const result = await catalogueService.findById(1);

      expect(result).toEqual(mockCatalogue);
      expect(mockPrisma.catalogue.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.catalogue.findUnique.mockResolvedValue(null);

      const result = await catalogueService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the catalogue', async () => {
      const dto = {
        name: 'Catalogue 2',
        file_url: 'https://example.com/cat2.pdf',
      };

      mockPrisma.catalogue.create.mockResolvedValue({ id: 2, ...dto, uploaded_at: new Date() });

      const result = await catalogueService.create(dto);

      expect(result).toMatchObject({ id: 2, name: dto.name });
      expect(mockPrisma.catalogue.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the catalogue', async () => {
      const dto = { name: 'Updated' };
      const updated = { ...mockCatalogue, name: 'Updated' };

      mockPrisma.catalogue.update.mockResolvedValue(updated);

      const result = await catalogueService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.catalogue.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when catalogue does not exist', async () => {
      mockPrisma.catalogue.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(catalogueService.update(999, { name: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the catalogue', async () => {
      mockPrisma.catalogue.delete.mockResolvedValue(mockCatalogue);

      await catalogueService.remove(1);

      expect(mockPrisma.catalogue.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when catalogue does not exist', async () => {
      mockPrisma.catalogue.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(catalogueService.remove(999)).rejects.toThrow();
    });
  });
});
