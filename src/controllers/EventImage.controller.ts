import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { parseId } from "../utils/parseId.js";
import {
  getAllEventImages,
  getEventImageById,
  getEventImagesByEventId,
  createEventImage,
  updateEventImage,
  deleteEventImage,
} from "../services/EventImage.services.js";


export const handleGetAllEventImages = asyncHandler(async (req: Request, res: Response) => {
    const eventImages = await getAllEventImages(!req.user);
    res.json({ eventImages });
});

export const handleGetEventImage = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const eventImage = await getEventImageById(id, !req.user);
    res.json({ eventImage });
});

export const handleGetEventImagesByEventId = asyncHandler(async (req: Request, res: Response) => {
    const eventId = parseId(req.params.eventId as string);
    const eventImages = await getEventImagesByEventId(eventId, !req.user);
    res.json({ eventImages });
});

export const handleCreateEventImage = asyncHandler(async (req: Request, res: Response) => {
  const { event_id, image_url, caption, position } = req.body;
 
  const eventImage = await createEventImage({
    event: { connect: { id: event_id } },
    image_url,
    caption,
    position,
  });
 
  res.status(201).json({ message: "Image d'événement créée avec succès", eventImage });
});
 
export const handleUpdateEventImage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { event_id, image_url, caption, position } = req.body;
  const eventImage = await updateEventImage(id, {
    ...(event_id !== undefined ? { event: { connect: { id: event_id } } } : {}),
    image_url,
    caption,
    position,
  });
  res.json({ message: "Image d'événement mise à jour avec succès", eventImage });
});
 
export const handleDeleteEventImage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteEventImage(id);
  res.json({ message: "Image d'événement supprimée avec succès" });
});
