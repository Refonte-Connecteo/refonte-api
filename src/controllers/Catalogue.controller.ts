import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { parseId } from "../utils/parseId.js";
import {
  getAllCatalogues,
  getCatalogueById,
  getImpactReport,
  createCatalogue,
  updateCatalogue,
  deleteCatalogue,
} from "../services/Catalogue.services.js";


export const handleGetAllCatalogues = asyncHandler(async (req: Request, res: Response) => {
    const catalogues = await getAllCatalogues();
    res.json({ catalogues });
});

export const handleGetCatalogue = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const catalogue = await getCatalogueById(id);
    res.json({ catalogue });
});

export const handleGetImpactReport = asyncHandler(async (_req: Request, res: Response) => {
    const catalogue = await getImpactReport();
    res.json({ catalogue });
});

export const handleCreateCatalogue = asyncHandler(async (req: Request, res: Response) => {
  const { title, file_url, is_lead_magnet, year, is_impact_report } = req.body;
 
  const catalogue = await createCatalogue({
    title,
    file_url,
    is_lead_magnet,
    year,
    is_impact_report,
  });
 
  res.status(201).json({ message: "Catalogue créé avec succès", catalogue });
});
 
export const handleUpdateCatalogue = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { title, file_url, is_lead_magnet, year, is_impact_report } = req.body;
  const catalogue = await updateCatalogue(id, { title, file_url, is_lead_magnet, year, is_impact_report });
  res.json({ message: "Catalogue mis à jour avec succès", catalogue });
});
 
export const handleDeleteCatalogue = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteCatalogue(id);
  res.json({ message: "Catalogue supprimé avec succès" });
});
