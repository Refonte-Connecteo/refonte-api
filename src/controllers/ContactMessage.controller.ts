import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllContactMessages,
  getContactMessageById,
  createContactMessage,
  markAsRead,
  deleteContactMessage,
} from "../services/ContactMessage.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllContactMessages = asyncHandler(async (req: Request, res: Response) => {
    const contactMessages = await getAllContactMessages();
    res.json({ contactMessages });
});

export const handleGetContactMessage = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const contactMessage = await getContactMessageById(id);
    res.json({ contactMessage });
});

export const handleCreateContactMessage = asyncHandler(async (req: Request, res: Response) => {
  const { first_name, last_name, email, phone, company, country, message } = req.body;
 
  const contactMessage = await createContactMessage({
    first_name,
    last_name,
    email,
    phone,
    company,
    country,
    message,
  });
 
  res.status(201).json({ message: "Message envoyé avec succès", contactMessage });
});
 
export const handleMarkAsRead = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const contactMessage = await markAsRead(id);
  res.json({ message: "Message marqué comme lu", contactMessage });
});
 
export const handleDeleteContactMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteContactMessage(id);
  res.json({ message: "Message supprimé avec succès" });
});
