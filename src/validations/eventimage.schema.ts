import { z } from "zod";
import { storedUrlSchema } from "./storedUrl.schema.js";

export const eventImageCreateSchema = z.object({
  event_id: z.number().int().positive("ID d'événement invalide"),
  image_url: storedUrlSchema,
  caption: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const eventImageUpdateSchema = eventImageCreateSchema.partial();
