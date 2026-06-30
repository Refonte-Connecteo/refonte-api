import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as kpiService from '@/services/kpi.services';

const mockKpiStat = {
  id: 1,
  label: 'KPI 1',
  value: '100',
  position: 1,
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  kpi_stat: {
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

describe('kpiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all stats ordered by position', async () => {
      mockPrisma.kpi_stat.findMany.mockResolvedValue([mockKpiStat]);

      const result = await kpiService.findAll();

      expect(result).toEqual([mockKpiStat]);
      expect(mockPrisma.kpi_stat.findMany).toHaveBeenCalledWith({
        orderBy: { position: 'asc' },
      });
    });

    it('returns empty array when no stats exist', async () => {
      mockPrisma.kpi_stat.findMany.mockResolvedValue([]);

      const result = await kpiService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the stat when found', async () => {
      mockPrisma.kpi_stat.findUnique.mockResolvedValue(mockKpiStat);

      const result = await kpiService.findById(1);

      expect(result).toEqual(mockKpiStat);
      expect(mockPrisma.kpi_stat.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.kpi_stat.findUnique.mockResolvedValue(null);

      const result = await kpiService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the stat', async () => {
      const dto = { label: 'KPI 2', value: '200', position: 2 };

      mockPrisma.kpi_stat.create.mockResolvedValue({ id: 2, ...dto, is_active: true });

      const result = await kpiService.create(dto);

      expect(result).toMatchObject({ id: 2, label: dto.label });
      expect(mockPrisma.kpi_stat.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the stat', async () => {
      const dto = { label: 'Mis à jour' };
      const updated = { ...mockKpiStat, label: 'Mis à jour' };

      mockPrisma.kpi_stat.update.mockResolvedValue(updated);

      const result = await kpiService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.kpi_stat.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when stat does not exist', async () => {
      mockPrisma.kpi_stat.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(kpiService.update(999, { label: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the stat', async () => {
      mockPrisma.kpi_stat.delete.mockResolvedValue(mockKpiStat);

      await kpiService.remove(1);

      expect(mockPrisma.kpi_stat.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when stat does not exist', async () => {
      mockPrisma.kpi_stat.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(kpiService.remove(999)).rejects.toThrow();
    });
  });
});
