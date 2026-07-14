
import prisma from "../lib/prisma.js";

import type { Prisma, article } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";


export type ArticleInput = Omit<Prisma.articleCreateInput, "id">;

export async function getAllArticles(onlyPublished = false): Promise<article[]> 
{
    return prisma.article.findMany({
        where: onlyPublished ? { is_published: true } : undefined,
        orderBy: { published_at: "desc"},
    });
}

export async function getArticleById (id: number): Promise<article>
{
    const item = await prisma.article.findUnique({ where: { id } });
    if (!item) {
        throw new NotFoundError(`Article with id ${id} not found`);
    }
    return item;
}

export async function createArticle(data: ArticleInput): Promise<article>
{
    if (!data.title) {
        throw new BadRequestError("Title is required");
    }
    return prisma.article.create({ data });
}

export async function updateArticle(id: number, data: Partial<ArticleInput>): Promise<article> {
    await getArticleById(id);

    return prisma.article.update({ where: {id}, data});
}

export async function deleteArticle(id: number): Promise<void> {
    await getArticleById(id);

    await prisma.article.delete({ where: { id } });
} 
