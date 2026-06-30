import prisma from '@/lib/prisma';
import type { CreateReferenceDto, UpdateReferenceDto } from '@/interfaces/reference.interface';

export async function findAll() {
  return prisma.reference.findMany({ orderBy: { position: 'asc' } });
}

export async function findById(id: number) {
  return prisma.reference.findUnique({ where: { id } });
}

export async function create(data: CreateReferenceDto) {
  return prisma.reference.create({ data });
}

export async function update(id: number, data: UpdateReferenceDto) {
  return prisma.reference.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.reference.delete({ where: { id } });
}
