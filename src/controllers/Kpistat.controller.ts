import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllKpiStats,
  getKpiStatById,
  createKpiStat,
  updateKpiStat,
  deleteKpiStat,
} from "../services/Kpistat.services.js";

function parseId(rawId: string): number {
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    throw new BadRequestError("ID invalide");
  }
  return id;
}

export const handleGetAllKpiStats = asyncHandler(async (req: Request, res: Response) => {
  const onlyActive = req.query.active === "true";
  const stats = await getAllKpiStats(onlyActive);
  res.json({ stats });
});

export const handleGetKpiStat = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const stat = await getKpiStatById(id);
  res.json({ stat });
});

export const handleCreateKpiStat = asyncHandler(async (req: Request, res: Response) => {
  const { label, value, unit, position, is_active } = req.body;

  const stat = await createKpiStat({ label, value, unit, position, is_active });

  res.status(201).json({ message: "KPI créé avec succès", stat });
});

export const handleUpdateKpiStat = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { label, value, unit, position, is_active } = req.body;
  const stat = await updateKpiStat(id, { label, value, unit, position, is_active });
  res.json({ message: "KPI mis à jour avec succès", stat });
});

export const handleDeleteKpiStat = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteKpiStat(id);
  res.json({ message: "KPI supprimé avec succès" });
});