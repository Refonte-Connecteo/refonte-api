import { z } from "zod";

export const kpiStatCreateSchema = z.object({
  label: z.string().min(1, "Label requis").max(100),
  value: z.string().min(1, "Valeur requise").max(50),
  unit: z.string().max(20).optional().nullable(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const kpiStatUpdateSchema = kpiStatCreateSchema.partial();
