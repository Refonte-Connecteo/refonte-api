import prisma from '@/lib/prisma';
import type { CreateCatalogueDto, UpdateCatalogueDto } from '@/interfaces/catalogue.interface';

export async function findAll() {
  return prisma.catalogue.findMany({ orderBy: { uploaded_at: 'desc' } });
}

export async function findById(id: number) {
  return prisma.catalogue.findUnique({ where: { id } });
}

export async function create(data: CreateCatalogueDto) {
  return prisma.catalogue.create({ data });
}

export async function update(id: number, data: UpdateCatalogueDto) {
  return prisma.catalogue.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.catalogue.delete({ where: { id } });
}
