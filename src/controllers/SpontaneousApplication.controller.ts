import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllSpontaneousApplications,
  getSpontaneousApplicationById,
  createSpontaneousApplication,
  updateSpontaneousApplication,
  deleteSpontaneousApplication,
} from "../services/SpontaneousApplication.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllSpontaneousApplications = asyncHandler(async (req: Request, res: Response) => {
    const spontaneousApplications = await getAllSpontaneousApplications();
    res.json({ spontaneousApplications });
});

export const handleGetSpontaneousApplication = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const spontaneousApplication = await getSpontaneousApplicationById(id);
    res.json({ spontaneousApplication });
});

export const handleCreateSpontaneousApplication = asyncHandler(async (req: Request, res: Response) => {
  const { first_name, last_name, email, phone, cv_url, motivation } = req.body;
 
  const spontaneousApplication = await createSpontaneousApplication({
    first_name,
    last_name,
    email,
    phone,
    cv_url,
    motivation,
  });
 
  res.status(201).json({ message: "Candidature spontanée créée avec succès", spontaneousApplication });
});
 
export const handleUpdateSpontaneousApplication = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const spontaneousApplication = await updateSpontaneousApplication(id, req.body);
  res.json({ message: "Candidature spontanée mise à jour avec succès", spontaneousApplication });
});
 
export const handleDeleteSpontaneousApplication = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteSpontaneousApplication(id);
  res.json({ message: "Candidature spontanée supprimée avec succès" });
});
