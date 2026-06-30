import prisma from '@/lib/prisma';
import type { CreateCeoMessageDto, UpdateCeoMessageDto } from '@/interfaces/ceo-message.interface';

export async function findAll() {
  return prisma.ceo_message.findMany({ orderBy: { updated_at: 'desc' } });
}

export async function findById(id: number) {
  return prisma.ceo_message.findUnique({ where: { id } });
}

export async function create(data: CreateCeoMessageDto) {
  return prisma.ceo_message.create({ data });
}

export async function update(id: number, data: UpdateCeoMessageDto) {
  return prisma.ceo_message.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.ceo_message.delete({ where: { id } });
}
