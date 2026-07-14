
import prisma from "../lib/prisma.js";

import type { Prisma, application } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type ApplicationInput = Omit<Prisma.applicationCreateInput, "id">;

export async function getAllApplications(): Promise<application[]> 
{
    return prisma.application.findMany({
        orderBy: { submitted_at: "desc"},
        include: { job_posting: true },
    });
}

export async function getApplicationById (id: number): Promise<application>
{
    const item = await prisma.application.findUnique({ 
        where: { id },
        include: { job_posting: true },
    });
    if (!item) {
        throw new NotFoundError(`Application with id ${id} not found`);
    }
    return item;
}

export async function getApplicationsByJobId(jobId: number): Promise<application[]> 
{
    return prisma.application.findMany({
        where: { job_id: jobId },
        orderBy: { submitted_at: "desc"},
        include: { job_posting: true },
    });
}

export async function createApplication(data: ApplicationInput): Promise<application>
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
    
    // Verify job posting exists
    const jobPostingData = data.job_posting;
    if (jobPostingData && 'connect' in jobPostingData) {
        const jobId = (jobPostingData as { connect: { id: number } }).connect.id;
        const job = await prisma.job_posting.findUnique({ where: { id: jobId } });
        if (!job) {
            throw new NotFoundError(`Job posting with id ${jobId} not found`);
        }
    }
    
    return prisma.application.create({ data });
}

export async function updateApplication(id: number, data: Partial<ApplicationInput>): Promise<application> {
    await getApplicationById(id);

    return prisma.application.update({ where: {id}, data});
}

export async function deleteApplication(id: number): Promise<void> {
    await getApplicationById(id);

    await prisma.application.delete({ where: { id } });
} 
