
import prisma from "../lib/prisma.js";

import type { Prisma, catalogue } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";


export type CatalogueInput = Omit<Prisma.catalogueCreateInput, "id">;

export async function getAllCatalogues(): Promise<catalogue[]> 
{
    return prisma.catalogue.findMany({
        orderBy: { uploaded_at: "desc"},
    });
}

export async function getCatalogueById (id: number): Promise<catalogue>
{
    const item = await prisma.catalogue.findUnique({ where: { id } });
    if (!item) {
        throw new NotFoundError(`Catalogue with id ${id} not found`);
    }
    return item;
}

export async function createCatalogue(data: CatalogueInput): Promise<catalogue>
{
    if (!data.title) {
        throw new BadRequestError("Title is required");
    }
    if (!data.file_url) {
        throw new BadRequestError("File URL is required");
    }

    return prisma.$transaction(async (tx) => {
        if (data.is_impact_report) {
            await tx.catalogue.updateMany({
                where: { is_impact_report: true },
                data: { is_impact_report: false },
            });
        }
        return tx.catalogue.create({ data });
    });
}

export async function updateCatalogue(id: number, data: Partial<CatalogueInput>): Promise<catalogue> {
    await getCatalogueById(id);

    return prisma.$transaction(async (tx) => {
        if (data.is_impact_report === true) {
            await tx.catalogue.updateMany({
                where: { is_impact_report: true, id: { not: id } },
                data: { is_impact_report: false },
            });
        }
        return tx.catalogue.update({ where: { id }, data });
    });
}

export async function getImpactReport(): Promise<catalogue | null> {
    return prisma.catalogue.findFirst({
        where: { is_impact_report: true },
        orderBy: { uploaded_at: "desc" },
    });
}

export async function deleteCatalogue(id: number): Promise<void> {
    await getCatalogueById(id);

    await prisma.catalogue.delete({ where: { id } });
} 
