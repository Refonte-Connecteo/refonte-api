import prisma from '@/lib/prisma';
import type { CreateServiceDto, UpdateServiceDto } from '@/interfaces/service.interface';
import { uploadToS3, deleteFromS3, buildS3Key, extractS3Key } from '@/config/s3';

export async function findAll() {
  return prisma.service.findMany({
    orderBy: { position: 'asc' },
    include: { sectors: { orderBy: { position: 'asc' } } },
  });
}

export async function findById(id: number) {
  return prisma.service.findUnique({
    where: { id },
    include: { sectors: { orderBy: { position: 'asc' } } },
  });
}

export async function create(data: CreateServiceDto, file?: Express.Multer.File) {
  let file_url: string | undefined;

  if (file) {
    const key = buildS3Key(0, file.originalname);
    file_url = await uploadToS3(file.buffer, key, file.mimetype);
  }

  return prisma.service.create({
    data: { ...data, file_url },
    include: { sectors: true },
  });
}

export async function update(id: number, data: UpdateServiceDto, file?: Express.Multer.File) {
  const existing = await prisma.service.findUnique({ where: { id } });

  if (!existing) return null;

  if (file) {
    if (existing.file_url) {
      const oldKey = extractS3Key(existing.file_url);
      if (oldKey) {
        await deleteFromS3(oldKey).catch(() => {});
      }
    }

    const key = buildS3Key(id, file.originalname);
    const file_url = await uploadToS3(file.buffer, key, file.mimetype);
    return prisma.service.update({
      where: { id },
      data: { ...data, file_url },
      include: { sectors: true },
    });
  }

  return prisma.service.update({
    where: { id },
    data,
    include: { sectors: true },
  });
}

export async function remove(id: number) {
  const existing = await prisma.service.findUnique({ where: { id } });

  if (!existing) return null;

  if (existing.file_url) {
    const key = extractS3Key(existing.file_url);
    if (key) {
      await deleteFromS3(key).catch(() => {});
    }
  }

  return prisma.service.delete({ where: { id } });
}
