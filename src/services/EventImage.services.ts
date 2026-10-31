
import prisma from "../lib/prisma.js";

import type { Prisma, event_image } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";


export type EventImageInput = Omit<Prisma.event_imageCreateInput, "id">;

async function assertEventExists(eventData: EventImageInput["event"] | undefined): Promise<void> {
    if (!eventData || !eventData.connect?.id) return;
    const eventId = eventData.connect.id;
    const evt = await prisma.event.findUnique({ where: { id: eventId } });
    if (!evt) {
        throw new NotFoundError(`Event with id ${eventId} not found`);
    }
}

export async function getAllEventImages(onlyPublished = false): Promise<event_image[]> 
{
    return prisma.event_image.findMany({
        where: onlyPublished ? { event: { is_published: true } } : undefined,
        orderBy: { position: "asc"},
        include: { event: true },
    });
}

export async function getEventImageById (id: number, onlyPublished = false): Promise<event_image>
{
    const item = await prisma.event_image.findUnique({ 
        where: { id },
        include: { event: true },
    });
    if (!item || (onlyPublished && !item.event.is_published)) {
        throw new NotFoundError(`Event image with id ${id} not found`);
    }
    return item;
}

export async function getEventImagesByEventId(eventId: number, onlyPublished = false): Promise<event_image[]> 
{
    return prisma.event_image.findMany({
        where: { event_id: eventId, ...(onlyPublished ? { event: { is_published: true } } : {}) },
        orderBy: { position: "asc"},
    });
}

export async function createEventImage(data: EventImageInput): Promise<event_image>
{
    if (!data.image_url) {
        throw new BadRequestError("Image URL is required");
    }

    await assertEventExists(data.event);

    return prisma.event_image.create({ data });
}

export async function updateEventImage(id: number, data: Partial<EventImageInput>): Promise<event_image> {
    await getEventImageById(id);
    await assertEventExists(data.event);

    return prisma.event_image.update({ where: {id}, data});
}

export async function deleteEventImage(id: number): Promise<void> {
    await getEventImageById(id);

    await prisma.event_image.delete({ where: { id } });
} 
