import { z } from "zod";
import { storedUrlSchema } from "./storedUrl.schema.js";

export const ceoMessageCreateSchema = z.object({
  title: z.string().min(1, "Titre requis").max(255),
  description: z.string().min(1, "Description requise").max(5000),
  image_url: storedUrlSchema.optional().nullable(),
});

export const ceoMessageUpdateSchema = ceoMessageCreateSchema.partial();
