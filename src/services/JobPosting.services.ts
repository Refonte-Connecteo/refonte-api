
import prisma from "../lib/prisma.js";

import type { Prisma, job_posting } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type JobPostingInput = Omit<Prisma.job_postingCreateInput, "id">;

export async function getAllJobPostings(onlyActive = false): Promise<job_posting[]> 
{
    return prisma.job_posting.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: { created_at: "desc"},
        include: { applications: true },
    });
}

export async function getJobPostingById (id: number): Promise<job_posting>
{
    const item = await prisma.job_posting.findUnique({ 
        where: { id },
        include: { applications: true },
    });
    if (!item) {
        throw new NotFoundError(`Job posting with id ${id} not found`);
    }
    return item;
}

export async function createJobPosting(data: JobPostingInput): Promise<job_posting>
{
    if (!data.title) {
        throw new BadRequestError("Title is required");
    }
    if (!data.contract_type) {
        throw new BadRequestError("Contract type is required");
    }
    return prisma.job_posting.create({ data });
}

export async function updateJobPosting(id: number, data: Partial<JobPostingInput>): Promise<job_posting> {
    await getJobPostingById(id);

    return prisma.job_posting.update({ where: {id}, data});
}

export async function deleteJobPosting(id: number): Promise<void> {
    await getJobPostingById(id);

    await prisma.job_posting.delete({ where: { id } });
} 
