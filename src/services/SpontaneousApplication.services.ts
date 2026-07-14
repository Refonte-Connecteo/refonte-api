
import prisma from "../lib/prisma.js";

import type { Prisma, spontaneous_application } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type SpontaneousApplicationInput = Omit<Prisma.spontaneous_applicationCreateInput, "id">;

export async function getAllSpontaneousApplications(): Promise<spontaneous_application[]> 
{
    return prisma.spontaneous_application.findMany({
        orderBy: { submitted_at: "desc"},
    });
}

export async function getSpontaneousApplicationById (id: number): Promise<spontaneous_application>
{
    const item = await prisma.spontaneous_application.findUnique({ where: { id } });
    if (!item) {
        throw new NotFoundError(`Spontaneous application with id ${id} not found`);
    }
    return item;
}

export async function createSpontaneousApplication(data: SpontaneousApplicationInput): Promise<spontaneous_application>
{
    if (!data.first_name) {
        throw new BadRequestError("First name is required");
    }
    if (!data.last_name) {
        throw new BadRequestError("Last name is required");
    }
    if (!data.email) {
        throw new BadRequestError("Email is required");
    }
    if (!data.cv_url) {
        throw new BadRequestError("CV URL is required");
    }
    return prisma.spontaneous_application.create({ data });
}

export async function updateSpontaneousApplication(id: number, data: Partial<SpontaneousApplicationInput>): Promise<spontaneous_application> {
    await getSpontaneousApplicationById(id);

    return prisma.spontaneous_application.update({ where: {id}, data});
}

export async function deleteSpontaneousApplication(id: number): Promise<void> {
    await getSpontaneousApplicationById(id);

    await prisma.spontaneous_application.delete({ where: { id } });
} 
