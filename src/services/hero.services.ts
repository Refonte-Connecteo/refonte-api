import prisma from '@/lib/prisma';
import type { CreateHeroSlideDto, UpdateHeroSlideDto } from '@/interfaces/hero.interface';

export async function findAll() {
  return prisma.hero_slide.findMany({ orderBy: { position: 'asc' } });
}

export async function findById(id: number) {
  return prisma.hero_slide.findUnique({ where: { id } });
}

export async function create(data: CreateHeroSlideDto) {
  return prisma.hero_slide.create({ data });
}

export async function update(id: number, data: UpdateHeroSlideDto) {
  return prisma.hero_slide.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.hero_slide.delete({ where: { id } });
}
