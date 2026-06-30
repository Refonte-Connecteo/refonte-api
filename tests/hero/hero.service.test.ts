import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as heroService from '@/services/hero.services';

const mockHeroSlide = {
  id: 1,
  image_url: 'https://example.com/slide.jpg',
  title: 'Titre',
  description: 'Description',
  cta_label: 'En savoir plus',
  cta_url: 'https://example.com',
  position: 1,
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  hero_slide: {
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

describe('heroService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all slides ordered by position', async () => {
      mockPrisma.hero_slide.findMany.mockResolvedValue([mockHeroSlide]);

      const result = await heroService.findAll();

      expect(result).toEqual([mockHeroSlide]);
      expect(mockPrisma.hero_slide.findMany).toHaveBeenCalledWith({
        orderBy: { position: 'asc' },
      });
    });

    it('returns empty array when no slides exist', async () => {
      mockPrisma.hero_slide.findMany.mockResolvedValue([]);

      const result = await heroService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the slide when found', async () => {
      mockPrisma.hero_slide.findUnique.mockResolvedValue(mockHeroSlide);

      const result = await heroService.findById(1);

      expect(result).toEqual(mockHeroSlide);
      expect(mockPrisma.hero_slide.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.hero_slide.findUnique.mockResolvedValue(null);

      const result = await heroService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the slide', async () => {
      const dto = {
        image_url: 'https://example.com/new.jpg',
        title: 'Nouveau',
        position: 2,
      };

      mockPrisma.hero_slide.create.mockResolvedValue({ id: 2, ...dto, description: null, cta_label: null, cta_url: null, is_active: true });

      const result = await heroService.create(dto);

      expect(result).toMatchObject({ id: 2, image_url: dto.image_url });
      expect(mockPrisma.hero_slide.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the slide', async () => {
      const dto = { title: 'Mis à jour' };
      const updated = { ...mockHeroSlide, title: 'Mis à jour' };

      mockPrisma.hero_slide.update.mockResolvedValue(updated);

      const result = await heroService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.hero_slide.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when slide does not exist', async () => {
      mockPrisma.hero_slide.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(heroService.update(999, { title: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the slide', async () => {
      mockPrisma.hero_slide.delete.mockResolvedValue(mockHeroSlide);

      await heroService.remove(1);

      expect(mockPrisma.hero_slide.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when slide does not exist', async () => {
      mockPrisma.hero_slide.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(heroService.remove(999)).rejects.toThrow();
    });
  });
});
