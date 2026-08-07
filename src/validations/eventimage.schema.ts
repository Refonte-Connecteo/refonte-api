import { z } from "zod";

export const eventImageCreateSchema = z.object({
  event_id: z.number().int().positive("ID d'événement invalide"),
  image_url: z.string().max(500),
  caption: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const eventImageUpdateSchema = eventImageCreateSchema.partial();
