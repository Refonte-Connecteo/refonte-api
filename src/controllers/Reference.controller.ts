import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllReferences,
  getReferenceById,
  createReference,
  updateReference,
  deleteReference,
} from "../services/Reference.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllReferences = asyncHandler(async (req: Request, res: Response) => {
    const onlyActive = req.query.onlyActive === "true";
    const references = await getAllReferences(onlyActive);
    res.json({ references });
});

export const handleGetReference = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const reference = await getReferenceById(id);
    res.json({ reference });
});

export const handleCreateReference = asyncHandler(async (req: Request, res: Response) => {
  const { label, image_url, website_url, position, is_active } = req.body;
 
  const reference = await createReference({
    label,
    image_url,
    website_url,
    position,
    is_active,
  });
 
  res.status(201).json({ message: "Référence créée avec succès", reference });
});
 
export const handleUpdateReference = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const reference = await updateReference(id, req.body);
  res.json({ message: "Référence mise à jour avec succès", reference });
});
 
export const handleDeleteReference = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteReference(id);
  res.json({ message: "Référence supprimée avec succès" });
});
