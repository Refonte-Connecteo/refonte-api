import { z } from "zod";

export const ceoMessageCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  description: z.string().min(1, "Description requise").max(5000),
  image_url: z.string().max(500).optional().nullable(),
});

export const ceoMessageUpdateSchema = ceoMessageCreateSchema.partial();
