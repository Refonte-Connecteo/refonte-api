import { z } from "zod";

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  description: z.string().max(5000).optional(),
  type: z.string().max(50).optional(),
  cover_url: z.string().url().max(500).optional().nullable(),
  file_url: z.string().url().max(500).optional().nullable(),
  is_lead_magnet: z.boolean().optional(),
  is_published: z.boolean().optional(),
  published_at: z.string().datetime().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();
