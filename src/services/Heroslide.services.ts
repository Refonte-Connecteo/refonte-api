
import prisma from "../lib/prisma.js";

import type { Prisma, hero_slide } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type HeroSlideInput = Omit<Prisma.hero_slideCreateInput, "id">;

export async function getAllHeroSlides(onlyActive = false): Promise<hero_slide[]> 
{
    return prisma.hero_slide.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: { position: "asc"},
    });
}

export async function getHeroSlideById (id: number): Promise<hero_slide>
{
    const slide = await prisma.hero_slide.findUnique({ where: { id } });
    if (!slide) {
        throw new NotFoundError(`Hero slide with id ${id} not found`);
    }
    return slide;
}

export async function createHeroSlide(data: HeroSlideInput): Promise<hero_slide>
{
    if (!data.image_url) {
        throw new BadRequestError("Image URL is required");
    }
    return prisma.hero_slide.create({ data });
}

export async function updateHeroSlide(id: number, data: Partial<HeroSlideInput>): Promise<hero_slide> {
    await getHeroSlideById(id);

    return prisma.hero_slide.update({ where: {id}, data});
}

export async function deleteHeroSlide(id: number): Promise<void> {
    await getHeroSlideById(id);

    await prisma.hero_slide.delete({ where: { id } });
} 