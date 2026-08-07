import { z } from "zod";

export const referenceCreateSchema = z.object({
  label: z.string().min(1, "Label requis").max(255),
  image_url: z.string().max(500),
  website_url: z.string().url().max(500).optional().nullable(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const referenceUpdateSchema = referenceCreateSchema.partial();
