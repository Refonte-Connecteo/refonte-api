import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as eventService from '@/services/event.services';

const mockEvent = {
  id: 1,
  title: 'Event 1',
  description: 'Desc',
  event_date: new Date('2024-06-15'),
  location: 'Paris',
  is_active: true,
  event_images: [],
};

const mockPrisma = vi.hoisted(() => ({
  event: {
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

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all events ordered by id desc', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent]);

      const result = await eventService.findAll();

      expect(result).toEqual([mockEvent]);
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'desc' },
      });
    });

    it('returns empty array when no events exist', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);

      const result = await eventService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the event when found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);

      const result = await eventService.findById(1);

      expect(result).toEqual(mockEvent);
      expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { event_images: { orderBy: { position: 'asc' } } },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const result = await eventService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the event', async () => {
      const dto = { title: 'Event 2', description: 'Desc', event_date: '2024-06-15', location: 'Lyon' };

      mockPrisma.event.create.mockResolvedValue({ id: 2, ...dto, event_date: new Date('2024-06-15'), is_active: true });

      const result = await eventService.create(dto);

      expect(result).toMatchObject({ id: 2, title: dto.title });
      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: { ...dto, event_date: new Date('2024-06-15') },
      });
    });
  });

  describe('update', () => {
    it('updates and returns the event', async () => {
      const dto = { title: 'Mis à jour' };
      const updated = { ...mockEvent, title: 'Mis à jour' };

      mockPrisma.event.update.mockResolvedValue(updated);

      const result = await eventService.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('throws when event does not exist', async () => {
      mockPrisma.event.update.mockRejectedValue(new Error('RecordNotFound'));

      await expect(eventService.update(999, { title: 'Nope' })).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the event', async () => {
      mockPrisma.event.delete.mockResolvedValue(mockEvent);

      await eventService.remove(1);

      expect(mockPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws when event does not exist', async () => {
      mockPrisma.event.delete.mockRejectedValue(new Error('RecordNotFound'));

      await expect(eventService.remove(999)).rejects.toThrow();
    });
  });
});
