import prisma from '@/lib/prisma';
import type { CreateSpontaneousApplicationDto, UpdateSpontaneousApplicationDto } from '@/interfaces/spontaneous-application.interface';

export async function findAll() {
  return prisma.spontaneous_application.findMany({ orderBy: { submitted_at: 'desc' } });
}

export async function findById(id: number) {
  return prisma.spontaneous_application.findUnique({ where: { id } });
}

export async function create(data: CreateSpontaneousApplicationDto) {
  return prisma.spontaneous_application.create({ data });
}

export async function update(id: number, data: UpdateSpontaneousApplicationDto) {
  return prisma.spontaneous_application.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.spontaneous_application.delete({ where: { id } });
}
