import prisma from '@/lib/prisma';
import type { CreateKpiStatDto, UpdateKpiStatDto } from '@/interfaces/kpi.interface';

export async function findAll() {
  return prisma.kpi_stat.findMany({ orderBy: { position: 'asc' } });
}

export async function findById(id: number) {
  return prisma.kpi_stat.findUnique({ where: { id } });
}

export async function create(data: CreateKpiStatDto) {
  return prisma.kpi_stat.create({ data });
}

export async function update(id: number, data: UpdateKpiStatDto) {
  return prisma.kpi_stat.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.kpi_stat.delete({ where: { id } });
}
