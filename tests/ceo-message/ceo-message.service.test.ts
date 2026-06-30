import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ceoMessageService from '@/services/ceo-message.services';

const mockCeoMessage = {
  id: 1,
  content: 'Message content',
  author: 'CEO',
  updated_at: new Date('2024-01-01'),
};

const mockPrisma = vi.hoisted(() => ({
  ceo_message: {
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

describe('ceoMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all messages ordered by updated_at desc', async () => {
      mockPrisma.ceo_message.findMany.mockResolvedValue([mockCeoMessage]);

      const result = await ceoMessageService.findAll();

      expect(result).toEqual([mockCeoMessage]);
      expect(mockPrisma.ceo_message.findMany).toHaveBeenCalledWith({
        orderBy: { updated_at: 'desc' },
      });
    });

    it('returns empty array when no messages exist', async () => {
      mockPrisma.ceo_message.findMany.mockResolvedValue([]);

      const result = await ceoMessageService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the message when found', async () => {
      mockPrisma.ceo_message.findUnique.mockResolvedValue(mockCeoMessage);

      const result = await ceoMessageService.findById(1);

      expect(result).toEqual(mockCeoMessage);
      expect(mockPrisma.ceo_message.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.ceo_message.findUnique.mockResolvedValue(null);

      const result = await ceoMessageService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the message', async () => {
      const dto = {
        content: 'New message',
        author: 'CEO',
      };

      mockPrisma.ceo_message.create.mockResolvedValue({ id: 2, ...dto, updated_at: new Date() });

      const result = await ceoMessageService.create(dto);

      expect(result).toMatchObject({ id: 2, content: dto.content });
      expect(mockPrisma.ceo_message.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('updates and returns the message', async () => {
      const dto = { content: 'Updated' };
      const updated = { ...mockCeoMessage, content: 'Updated' };

      mockPrisma.ceo_message.update.mockResolvedValue(updated);

      const result = await ceoMessageService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.ceo_message.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when message does not exist', async () => {
      mockPrisma.ceo_message.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(ceoMessageService.update(999, { content: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the message', async () => {
      mockPrisma.ceo_message.delete.mockResolvedValue(mockCeoMessage);

      await ceoMessageService.remove(1);

      expect(mockPrisma.ceo_message.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when message does not exist', async () => {
      mockPrisma.ceo_message.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(ceoMessageService.remove(999)).rejects.toThrow();
    });
  });
});
