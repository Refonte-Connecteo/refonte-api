
import prisma from "../lib/prisma.js";

import type { Prisma, kpi_stat } from "../generated/prisma/client.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";

export type KpiStatInput = Omit<Prisma.kpi_statCreateInput, "id">;

export async function getAllKpiStats(onlyActive = false): Promise<kpi_stat[]> 
{
    return prisma.kpi_stat.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: { position: "asc"},
    });
}

export async function getKpiStatById (id: number): Promise<kpi_stat>
{
    const stat = await prisma.kpi_stat.findUnique({ where: { id } });
    if (!stat) {
        throw new NotFoundError(`KPI stat with id ${id} not found`);
    }
    return stat;
}

export async function createKpiStat(data: KpiStatInput): Promise<kpi_stat>
{
    if (!data.label || data.value === undefined) {
        throw new BadRequestError("Label and value are required");
    }
    return prisma.kpi_stat.create({ data });
}

export async function updateKpiStat(id: number, data: Partial<KpiStatInput>): Promise<kpi_stat> {
    await getKpiStatById(id);
    return prisma.kpi_stat.update({ where: {id}, data});
}

export async function deleteKpiStat(id: number): Promise<void> {
    await getKpiStatById(id);
    await prisma.kpi_stat.delete({ where: { id } });
}
