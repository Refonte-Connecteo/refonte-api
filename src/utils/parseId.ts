import { BadRequestError } from "../errors/index.js";

const MAX_POSTGRES_INT = 2147483647;

/** Valide un identifiant d'URL : entier positif tenant dans une colonne INT. */
export function parseId(rawId: string): number {
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_POSTGRES_INT) {
    throw new BadRequestError("Identifiant invalide");
  }
  return id;
}
