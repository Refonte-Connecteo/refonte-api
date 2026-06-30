import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as jobPostingService from '@/services/job-posting.services';

const mockJobPosting = {
  id: 1,
  title: 'Développeur',
  description: 'Description',
  location: 'Paris',
  type: 'CDI',
  created_at: new Date('2024-01-01'),
  is_active: true,
};

const mockPrisma = vi.hoisted(() => ({
  job_posting: {
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

describe('jobPostingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all postings ordered by created_at desc', async () => {
      mockPrisma.job_posting.findMany.mockResolvedValue([mockJobPosting]);

      const result = await jobPostingService.findAll();

      expect(result).toEqual([mockJobPosting]);
      expect(mockPrisma.job_posting.findMany).toHaveBeenCalledWith({
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns empty array when no postings exist', async () => {
      mockPrisma.job_posting.findMany.mockResolvedValue([]);

      const result = await jobPostingService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the posting when found', async () => {
      mockPrisma.job_posting.findUnique.mockResolvedValue(mockJobPosting);

      const result = await jobPostingService.findById(1);

      expect(result).toEqual(mockJobPosting);
      expect(mockPrisma.job_posting.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.job_posting.findUnique.mockResolvedValue(null);

      const result = await jobPostingService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the posting', async () => {
      const dto = { title: 'Nouveau poste', description: 'Desc', location: 'Lyon', type: 'CDD' };

      mockPrisma.job_posting.create.mockResolvedValue({ id: 2, ...dto, created_at: new Date(), is_active: true });

      const result = await jobPostingService.create(dto);

      expect(result).toMatchObject({ id: 2, title: dto.title });
      expect(mockPrisma.job_posting.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the posting', async () => {
      const dto = { title: 'Mis à jour' };
      const updated = { ...mockJobPosting, title: 'Mis à jour' };

      mockPrisma.job_posting.update.mockResolvedValue(updated);

      const result = await jobPostingService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.job_posting.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when posting does not exist', async () => {
      mockPrisma.job_posting.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(jobPostingService.update(999, { title: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the posting', async () => {
      mockPrisma.job_posting.delete.mockResolvedValue(mockJobPosting);

      await jobPostingService.remove(1);

      expect(mockPrisma.job_posting.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when posting does not exist', async () => {
      mockPrisma.job_posting.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(jobPostingService.remove(999)).rejects.toThrow();
    });
  });
});
