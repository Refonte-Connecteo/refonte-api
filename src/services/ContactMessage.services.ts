
import prisma from "../lib/prisma.js";

import type { Prisma, contact_message } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type ContactMessageInput = Omit<Prisma.contact_messageCreateInput, "id">;

export async function getAllContactMessages(): Promise<contact_message[]> 
{
    return prisma.contact_message.findMany({
        orderBy: { submitted_at: "desc"},
    });
}

export async function getContactMessageById (id: number): Promise<contact_message>
{
    const item = await prisma.contact_message.findUnique({ where: { id } });
    if (!item) {
        throw new NotFoundError(`Contact message with id ${id} not found`);
    }
    return item;
}

export async function createContactMessage(data: ContactMessageInput): Promise<contact_message>
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
    if (!data.message) {
        throw new BadRequestError("Message is required");
    }
    return prisma.contact_message.create({ data });
}

export async function markAsRead(id: number): Promise<contact_message> {
    await getContactMessageById(id);

    return prisma.contact_message.update({ where: {id}, data: { is_read: true }});
}

export async function deleteContactMessage(id: number): Promise<void> {
    await getContactMessageById(id);

    await prisma.contact_message.delete({ where: { id } });
} 
