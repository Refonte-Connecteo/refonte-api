import { z } from "zod";

export const eventCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  description: z.string().max(5000).optional().nullable(),
  event_date: z.string().datetime().optional().nullable(),
  youtube_url: z.string().url().max(500).optional().nullable(),
  is_published: z.boolean().optional(),
});

export const eventUpdateSchema = eventCreateSchema.partial();
