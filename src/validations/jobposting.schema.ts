import { z } from "zod";

export const jobPostingCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  contract_type: z.string().min(1, "Type de contrat requis").max(100),
  description: z.string().max(5000).optional().nullable(),
  external_url: z.string().url().max(500).optional().nullable(),
  fiche_url: z.string().url().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const jobPostingUpdateSchema = jobPostingCreateSchema.partial();
