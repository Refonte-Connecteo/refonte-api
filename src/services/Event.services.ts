
import prisma from "../lib/prisma.js";

import type { Prisma, event } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type EventInput = Omit<Prisma.eventCreateInput, "id">;

export async function getAllEvents(onlyPublished = false): Promise<event[]> 
{
    return prisma.event.findMany({
        where: onlyPublished ? { is_published: true } : undefined,
        orderBy: { event_date: "desc"},
        include: { event_images: { orderBy: { position: "asc"} } },
    });
}

export async function getEventById (id: number): Promise<event>
{
    const item = await prisma.event.findUnique({ 
        where: { id },
        include: { event_images: { orderBy: { position: "asc"} } },
    });
    if (!item) {
        throw new NotFoundError(`Event with id ${id} not found`);
    }
    return item;
}

export async function createEvent(data: EventInput): Promise<event>
{
    if (!data.title) {
        throw new BadRequestError("Title is required");
    }
    return prisma.event.create({ data });
}

export async function updateEvent(id: number, data: Partial<EventInput>): Promise<event> {
    await getEventById(id);

    return prisma.event.update({ where: {id}, data});
}

export async function deleteEvent(id: number): Promise<void> {
    await getEventById(id);

    await prisma.event.delete({ where: { id } });
} 
