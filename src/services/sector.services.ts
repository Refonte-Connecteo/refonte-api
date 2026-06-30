import prisma from '@/lib/prisma';
import type { CreateSectorDto, UpdateSectorDto } from '@/interfaces/sector.interface';

export async function findAllByService(serviceId: number) {
  return prisma.sector.findMany({
    where: { service_id: serviceId },
    orderBy: { position: 'asc' },
  });
}

export async function findById(id: number) {
  return prisma.sector.findUnique({ where: { id } });
}

export async function create(serviceId: number, data: CreateSectorDto) {
  return prisma.sector.create({
    data: { ...data, service_id: serviceId },
  });
}

export async function update(id: number, data: UpdateSectorDto) {
  return prisma.sector.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.sector.delete({ where: { id } });
}
