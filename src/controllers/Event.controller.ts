import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../services/Event.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllEvents = asyncHandler(async (req: Request, res: Response) => {
    const onlyPublished = req.query.onlyPublished === "true";
    const events = await getAllEvents(onlyPublished);
    res.json({ events });
});

export const handleGetEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const event = await getEventById(id);
    res.json({ event });
});

export const handleCreateEvent = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, event_date, youtube_url, is_published } = req.body;
 
  const event = await createEvent({
    title,
    description,
    event_date,
    youtube_url,
    is_published,
  });
 
  res.status(201).json({ message: "Événement créé avec succès", event });
});
 
export const handleUpdateEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const event = await updateEvent(id, req.body);
  res.json({ message: "Événement mis à jour avec succès", event });
});
 
export const handleDeleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteEvent(id);
  res.json({ message: "Événement supprimé avec succès" });
});
