import prisma from '@/lib/prisma';
import type { CreateArticleDto, UpdateArticleDto } from '@/interfaces/article.interface';

export async function findAll() {
  return prisma.article.findMany({ orderBy: { published_at: 'desc' } });
}

export async function findById(id: number) {
  return prisma.article.findUnique({ where: { id } });
}

export async function create(data: CreateArticleDto) {
  return prisma.article.create({ data });
}

export async function update(id: number, data: UpdateArticleDto) {
  return prisma.article.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.article.delete({ where: { id } });
}
