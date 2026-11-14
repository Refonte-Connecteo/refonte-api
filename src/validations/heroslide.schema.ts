import { z } from "zod";
import { storedUrlSchema } from "./storedUrl.schema.js";

/** Pages qui affichent un carrousel hero administrable. */
export const HERO_PAGES = ["home", "impact"] as const;
export type HeroPage = (typeof HERO_PAGES)[number];

export const heroPageSchema = z.enum(HERO_PAGES);

/**
 * Lien du bouton : chemin interne (/page), ancre (#section) ou URL http(s).
 * Rejette javascript:, data:, les URL relatives au protocole (//hôte) et les espaces.
 */
export function isValidCtaUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  if (value.startsWith("//")) return false;
  return value.startsWith("/") || value.startsWith("#") || /^https?:\/\/[^\s]+$/i.test(value);
}

const ctaUrlSchema = z
  .string()
  .max(500)
  .refine(isValidCtaUrl, { message: "Lien du bouton invalide (/page, #section ou URL http(s))" });

export const heroSlideCreateSchema = z.object({
  page: heroPageSchema.optional(),
  image_url: storedUrlSchema,
  mobile_image_url: storedUrlSchema.optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  cta_label: z.string().max(100).optional().nullable(),
  cta_url: ctaUrlSchema.optional().nullable(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const heroSlideUpdateSchema = heroSlideCreateSchema.partial();
