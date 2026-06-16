import prisma from '@/lib/prisma';
import type { CreateEventDto, UpdateEventDto } from '@/interfaces/event.interface';

export async function findAll() {
  return prisma.event.findMany({ orderBy: { id: 'desc' } });
}

export async function findById(id: number) {
  return prisma.event.findUnique({
    where: { id },
    include: { event_images: { orderBy: { position: 'asc' } } },
  });
}

export async function create(data: CreateEventDto) {
  return prisma.event.create({
    data: {
      ...data,
      event_date: data.event_date ? new Date(data.event_date) : undefined,
    },
  });
}

export async function update(id: number, data: UpdateEventDto) {
  const parsed: any = { ...data };
  if (data.event_date !== undefined) {
    parsed.event_date = data.event_date ? new Date(data.event_date) : null;
  }
  return prisma.event.update({ where: { id }, data: parsed });
}

export async function remove(id: number) {
  return prisma.event.delete({ where: { id } });
}
