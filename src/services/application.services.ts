import prisma from '@/lib/prisma';
import type { CreateApplicationDto, UpdateApplicationDto } from '@/interfaces/application.interface';

export async function findAll() {
  return prisma.application.findMany({
    orderBy: { submitted_at: 'desc' },
    include: { job_posting: true },
  });
}

export async function findById(id: number) {
  return prisma.application.findUnique({
    where: { id },
    include: { job_posting: true },
  });
}

export async function create(data: CreateApplicationDto) {
  return prisma.application.create({ data });
}

export async function update(id: number, data: UpdateApplicationDto) {
  return prisma.application.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.application.delete({ where: { id } });
}
