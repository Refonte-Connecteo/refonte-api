import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllHeroSlides,
  getHeroSlideById,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} from "../services/Heroslide.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllHeroSlides = asyncHandler(async (req: Request, res: Response) => {
    const onlyActive = req.query.onlyActive === "true";
    const slides = await getAllHeroSlides(onlyActive);
    res.json({ slides });
});

export const handleGetHeroSlide = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const slide = await getHeroSlideById(id);
    res.json({ slide });
});

export const handleCreateHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, cta_label, cta_url, position, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;

  const slide = await createHeroSlide({
    image_url,
    title,
    description,
    cta_label,
    cta_url,
    position,
    is_active,
  });
 
  res.status(201).json({ message: "Slide créé avec succès", slide });
});
 
export const handleUpdateHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { title, description, cta_label, cta_url, position, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  const slide = await updateHeroSlide(id, { title, description, cta_label, cta_url, position, is_active, image_url });
  res.json({ message: "Slide mis à jour avec succès", slide });
});
 
export const handleDeleteHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteHeroSlide(id);
  res.json({ message: "Slide supprimé avec succès" });
});