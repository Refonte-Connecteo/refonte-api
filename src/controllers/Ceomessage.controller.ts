import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllCeoMessages,
  getLatestCeoMessage,
  getCeoMessageById,
  createCeoMessage,
  updateCeoMessage,
  deleteCeoMessage,
} from "../services/Ceomessage.services.js";

function parseId(rawId: string): number {
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    throw new BadRequestError("ID invalide");
  }
  return id;
}

export const handleGetAllCeoMessages = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await getAllCeoMessages();
  res.json({ messages });
});

// Utilisé par le front public pour afficher le message actuel
export const handleGetLatestCeoMessage = asyncHandler(async (_req: Request, res: Response) => {
  const message = await getLatestCeoMessage();
  res.json({ message });
});

export const handleGetCeoMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const message = await getCeoMessageById(id);
  res.json({ message });
});

export const handleCreateCeoMessage = asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;

  const message = await createCeoMessage({ title, description, image_url });

  res.status(201).json({ message: "Message CEO créé avec succès", data: message });
});

export const handleUpdateCeoMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { title, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  const message = await updateCeoMessage(id, { title, description, image_url });
  res.json({ message: "Message CEO mis à jour avec succès", data: message });
});

export const handleDeleteCeoMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteCeoMessage(id);
  res.json({ message: "Message CEO supprimé avec succès" });
});