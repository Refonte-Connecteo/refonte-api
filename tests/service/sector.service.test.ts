import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sectorService from '@/services/sector.services';

const mockSector = {
  id: 1,
  service_id: 1,
  title: 'Sector 1',
  description: 'Desc',
  icon: 'icon',
  position: 1,
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  sector: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

describe('sectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAllByService', () => {
    it('returns sectors filtered by service_id', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([mockSector]);

      const result = await sectorService.findAllByService(1);

      expect(result).toEqual([mockSector]);
      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith({
        where: { service_id: 1 },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('returns sector when found', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(mockSector);

      const result = await sectorService.findById(1);

      expect(result).toEqual(mockSector);
      expect(mockPrisma.sector.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      const result = await sectorService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates sector with service_id', async () => {
      const dto = { title: 'Sector 2', position: 2 };

      mockPrisma.sector.create.mockResolvedValue({
        id: 2,
        ...dto,
        service_id: 1,
        description: null,
        icon: null,
        is_active: true,
      });

      const result = await sectorService.create(1, dto);

      expect(result).toMatchObject({ id: 2, service_id: 1 });
      expect(mockPrisma.sector.create).toHaveBeenCalledWith({
        data: { ...dto, service_id: 1 },
      });
    });
  });

  describe('update', () => {
    it('updates sector by id', async () => {
      const dto = { title: 'Updated Sector' };
      const updated = { ...mockSector, title: 'Updated Sector' };

      mockPrisma.sector.update.mockResolvedValue(updated);

      const result = await sectorService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.sector.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });
  });

  describe('remove', () => {
    it('deletes sector by id', async () => {
      mockPrisma.sector.delete.mockResolvedValue(mockSector);

      await sectorService.remove(1);

      expect(mockPrisma.sector.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
});
