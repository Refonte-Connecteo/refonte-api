
import prisma from "../lib/prisma.js";

import type { Prisma, event_image } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type EventImageInput = Omit<Prisma.event_imageCreateInput, "id">;

export async function getAllEventImages(): Promise<event_image[]> 
{
    return prisma.event_image.findMany({
        orderBy: { position: "asc"},
        include: { event: true },
    });
}

export async function getEventImageById (id: number): Promise<event_image>
{
    const item = await prisma.event_image.findUnique({ 
        where: { id },
        include: { event: true },
    });
    if (!item) {
        throw new NotFoundError(`Event image with id ${id} not found`);
    }
    return item;
}

export async function getEventImagesByEventId(eventId: number): Promise<event_image[]> 
{
    return prisma.event_image.findMany({
        where: { event_id: eventId },
        orderBy: { position: "asc"},
    });
}

export async function createEventImage(data: EventImageInput): Promise<event_image>
{
    if (!data.image_url) {
        throw new BadRequestError("Image URL is required");
    }

    // Verify event exists
    const eventData = data.event;
    if (eventData && 'connect' in eventData) {
        const eventId = (eventData as { connect: { id: number } }).connect.id;
        const evt = await prisma.event.findUnique({ where: { id: eventId } });
        if (!evt) {
            throw new NotFoundError(`Event with id ${eventId} not found`);
        }
    }

    return prisma.event_image.create({ data });
}

export async function updateEventImage(id: number, data: Partial<EventImageInput>): Promise<event_image> {
    await getEventImageById(id);

    return prisma.event_image.update({ where: {id}, data});
}

export async function deleteEventImage(id: number): Promise<void> {
    await getEventImageById(id);

    await prisma.event_image.delete({ where: { id } });
} 
