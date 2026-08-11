import { z } from "zod";
import { storedUrlSchema } from "./storedUrl.schema.js";

export const referenceCreateSchema = z.object({
  label: z.string().min(1, "Label requis").max(255),
  image_url: storedUrlSchema,
  website_url: z.string().url().max(500).optional().nullable(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const referenceUpdateSchema = referenceCreateSchema.partial();
