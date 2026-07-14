
import prisma from "../lib/prisma.js";

import type { Prisma, reference } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type ReferenceInput = Omit<Prisma.referenceCreateInput, "id">;

export async function getAllReferences(onlyActive = false): Promise<reference[]> 
{
    return prisma.reference.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: { position: "asc"},
    });
}

export async function getReferenceById (id: number): Promise<reference>
{
    const item = await prisma.reference.findUnique({ where: { id } });
    if (!item) {
        throw new NotFoundError(`Reference with id ${id} not found`);
    }
    return item;
}

export async function createReference(data: ReferenceInput): Promise<reference>
{
    if (!data.label) {
        throw new BadRequestError("Label is required");
    }
    if (!data.image_url) {
        throw new BadRequestError("Image URL is required");
    }
    return prisma.reference.create({ data });
}

export async function updateReference(id: number, data: Partial<ReferenceInput>): Promise<reference> {
    await getReferenceById(id);

    return prisma.reference.update({ where: {id}, data});
}

export async function deleteReference(id: number): Promise<void> {
    await getReferenceById(id);

    await prisma.reference.delete({ where: { id } });
} 
