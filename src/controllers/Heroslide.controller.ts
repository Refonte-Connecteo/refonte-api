import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { parseId } from "../utils/parseId.js";
import {
  getAllHeroSlides,
  getHeroSlideById,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} from "../services/Heroslide.services.js";
import { heroPageSchema } from "../validations/heroslide.schema.js";
import { BadRequestError } from "../errors/index.js";

function parsePage(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = heroPageSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestError("Page inconnue (home ou impact)");
  return parsed.data;
}


export const handleGetAllHeroSlides = asyncHandler(async (req: Request, res: Response) => {
    const onlyActive = !req.user || req.query.onlyActive === "true";
    const slides = await getAllHeroSlides(onlyActive, parsePage(req.query.page));
    res.json({ slides });
});

export const handleGetHeroSlide = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const slide = await getHeroSlideById(id);
    res.json({ slide });
});

export const handleCreateHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const { page, mobile_image_url, title, description, cta_label, cta_url, position, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;

  const slide = await createHeroSlide({
    page,
    image_url,
    mobile_image_url,
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
  const { page, mobile_image_url, title, description, cta_label, cta_url, position, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  const slide = await updateHeroSlide(id, { page, mobile_image_url, title, description, cta_label, cta_url, position, is_active, image_url });
  res.json({ message: "Slide mis à jour avec succès", slide });
});
 
export const handleDeleteHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteHeroSlide(id);
  res.json({ message: "Slide supprimé avec succès" });
});