import { z } from "zod";

// Mode strict : tout champ non prévu est rejeté (minimisation RGPD).
export const contactMessageCreateSchema = z
  .object({
    first_name: z.string().min(1, "Prénom requis").max(100),
    last_name: z.string().min(1, "Nom requis").max(100),
    email: z.string().email("Email invalide").max(255),
    phone: z.string().max(20).optional().nullable(),
    company: z.string().max(200).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    message: z.string().min(1, "Message requis").max(5000),
  })
  .strict();
