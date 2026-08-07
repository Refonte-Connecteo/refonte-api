import { z } from "zod";

export const catalogueCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  file_url: z.string().max(500),
  is_lead_magnet: z.boolean().optional(),
});

export const catalogueUpdateSchema = catalogueCreateSchema.partial();
