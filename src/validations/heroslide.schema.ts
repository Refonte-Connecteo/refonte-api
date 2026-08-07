import { z } from "zod";

export const heroSlideCreateSchema = z.object({
  image_url: z.string().max(500),
  title: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  cta_label: z.string().max(100).optional().nullable(),
  cta_url: z.string().max(500).optional().nullable(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const heroSlideUpdateSchema = heroSlideCreateSchema.partial();
