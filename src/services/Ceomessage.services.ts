
import prisma from "../lib/prisma.js";

import type { Prisma, ceo_message } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";

export type CeoMessageInput = Omit<Prisma.ceo_messageCreateInput, "id" | "updated_at">;

export async function getAllCeoMessages(): Promise<ceo_message[]>
{
    return prisma.ceo_message.findMany({
        orderBy: { updated_at: "desc"},
    });
}

export async function getLatestCeoMessage(): Promise<ceo_message>
{
    const message = await prisma.ceo_message.findFirst({
        orderBy: { updated_at: "desc"},
    }); 

    if (!message) {
        throw new NotFoundError(`No CEO message found`);
    }
    return message;
}

export async function getCeoMessageById(id: number): Promise<ceo_message> {
  const message = await prisma.ceo_message.findUnique({ where: { id } });
 
  if (!message) {
    throw new NotFoundError("ceo_message");
  }
 
  return message;
}
 
export async function createCeoMessage(data: CeoMessageInput): Promise<ceo_message> {
  if (!data.title || !data.description) {
    throw new BadRequestError("title et description sont requis");
  }
 
  return prisma.ceo_message.create({ data });
}
 
export async function updateCeoMessage(
  id: number,
  data: Partial<CeoMessageInput>
): Promise<ceo_message> {
  await getCeoMessageById(id);
 
  return prisma.ceo_message.update({
    where: { id },
    data: { ...data, updated_at: new Date() },
  });
}
 
export async function deleteCeoMessage(id: number): Promise<void> {
  await getCeoMessageById(id);
 
  await prisma.ceo_message.delete({ where: { id } });
}
 