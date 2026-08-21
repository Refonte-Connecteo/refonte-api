import { z } from "zod";

// Mode strict : tout champ non prévu est rejeté (minimisation RGPD).
export const spontaneousApplicationCreateSchema = z
  .object({
    first_name: z.string().min(1, "Prénom requis").max(100),
    last_name: z.string().min(1, "Nom requis").max(100),
    email: z.string().email("Email invalide").max(255),
    phone: z.string().max(20).optional().nullable(),
    cv_url: z.string().max(500),
    motivation: z.string().max(5000).optional().nullable(),
  })
  .strict();

export const spontaneousApplicationUpdateSchema = z
  .object({
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(20).optional().nullable(),
    cv_url: z.string().max(500).optional(),
    motivation: z.string().max(5000).optional().nullable(),
  })
  .strict();
