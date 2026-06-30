import { z } from 'zod';

export const contactSchema = z.object({
  first_name: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
  last_name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('Format d\'email invalide')
    .max(255, 'L\'email ne peut pas dépasser 255 caractères'),
  phone: z
    .string()
    .max(30, 'Le téléphone ne peut pas dépasser 30 caractères')
    .optional(),
  company: z
    .string()
    .max(200, 'La société ne peut pas dépasser 200 caractères')
    .optional(),
  country: z
    .string()
    .max(100, 'Le pays ne peut pas dépasser 100 caractères')
    .optional(),
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(5000, 'Le message ne peut pas dépasser 5000 caractères'),
});

export type ContactInput = z.infer<typeof contactSchema>;
