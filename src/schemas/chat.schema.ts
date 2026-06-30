import { z } from 'zod';

export const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(4000, 'Le message ne peut pas dépasser 4000 caractères'),
});

export type ChatInput = z.infer<typeof chatSchema>;
