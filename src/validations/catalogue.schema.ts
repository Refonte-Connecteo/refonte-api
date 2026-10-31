import { z } from "zod";
import { storedUrlSchema } from "./storedUrl.schema.js";

export const catalogueCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  file_url: storedUrlSchema,
  is_lead_magnet: z.boolean().optional(),
  year: z.number().int().min(1900).max(3000).nullable().optional(),
  is_impact_report: z.boolean().optional(),
});

export const catalogueUpdateSchema = catalogueCreateSchema.partial();
