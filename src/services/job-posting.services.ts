import prisma from '@/lib/prisma';
import type { CreateJobPostingDto, UpdateJobPostingDto } from '@/interfaces/job-posting.interface';

export async function findAll() {
  return prisma.job_posting.findMany({ orderBy: { created_at: 'desc' } });
}

export async function findById(id: number) {
  return prisma.job_posting.findUnique({ where: { id } });
}

export async function create(data: CreateJobPostingDto) {
  return prisma.job_posting.create({ data });
}

export async function update(id: number, data: UpdateJobPostingDto) {
  return prisma.job_posting.update({ where: { id }, data });
}

export async function remove(id: number) {
  return prisma.job_posting.delete({ where: { id } });
}
