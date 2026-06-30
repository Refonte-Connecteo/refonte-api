import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as articleService from '@/services/article.services';

const mockArticle = {
  id: 1,
  title: 'Article 1',
  content: 'Content',
  image_url: 'https://example.com/img.jpg',
  published_at: new Date('2024-01-01'),
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  article: {
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

describe('articleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all articles ordered by published_at desc', async () => {
      mockPrisma.article.findMany.mockResolvedValue([mockArticle]);

      const result = await articleService.findAll();

      expect(result).toEqual([mockArticle]);
      expect(mockPrisma.article.findMany).toHaveBeenCalledWith({
        orderBy: { published_at: 'desc' },
      });
    });

    it('returns empty array when no articles exist', async () => {
      mockPrisma.article.findMany.mockResolvedValue([]);

      const result = await articleService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the article when found', async () => {
      mockPrisma.article.findUnique.mockResolvedValue(mockArticle);

      const result = await articleService.findById(1);

      expect(result).toEqual(mockArticle);
      expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      const result = await articleService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the article', async () => {
      const dto = { title: 'Article 2', content: 'More content', image_url: 'https://example.com/img2.jpg' };

      mockPrisma.article.create.mockResolvedValue({ id: 2, ...dto, published_at: new Date(), is_active: true });

      const result = await articleService.create(dto);

      expect(result).toMatchObject({ id: 2, title: dto.title });
      expect(mockPrisma.article.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the article', async () => {
      const dto = { title: 'Mis à jour' };
      const updated = { ...mockArticle, title: 'Mis à jour' };

      mockPrisma.article.update.mockResolvedValue(updated);

      const result = await articleService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when article does not exist', async () => {
      mockPrisma.article.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(articleService.update(999, { title: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the article', async () => {
      mockPrisma.article.delete.mockResolvedValue(mockArticle);

      await articleService.remove(1);

      expect(mockPrisma.article.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when article does not exist', async () => {
      mockPrisma.article.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(articleService.remove(999)).rejects.toThrow();
    });
  });
});
