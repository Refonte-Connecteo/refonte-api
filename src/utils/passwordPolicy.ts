import { BadRequestError } from "../errors/index.js";

/**
 * Politique des mots de passe administrateurs (recommandations ANSSI / NIST 800-63B) :
 * - 12 caractères minimum : la longueur compte plus que la complexité ;
 * - 72 octets maximum : bcrypt ignore tout ce qui dépasse, un mot de passe plus long
 *   donnerait une fausse impression de sécurité ;
 * - refus des mots de passe les plus courants et de ceux qui reprennent l'e-mail.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

/** Mots de passe trop courants (comparés en minuscules), liste locale : aucun appel externe. */
const COMMON_PASSWORDS = new Set([
  "123456789012", "1234567890123", "12345678901234", "000000000000", "111111111111",
  "azertyuiopqs", "azertyuiop123", "azerty123456", "qwertyuiop12", "qwerty123456",
  "motdepasse12", "motdepasse123", "motdepasse1234", "motdepasse123!", "monmotdepasse",
  "password1234", "password12345", "password123!", "passwordpassword", "passw0rd1234",
  "administrator", "administrateur", "admin1234567", "adminadmin123", "superadmin123",
  "connecteo2026", "connecteo2025", "connecteo123!", "connecteo1234", "bienvenue1234",
  "welcome12345", "welcome123456", "letmein12345", "iloveyou1234", "soleil123456",
  "changeme1234", "changezmoi123", "123456azerty", "1q2w3e4r5t6y", "aqwzsxedcrfv",
]);

export function assertPasswordPolicy(password: string, context: { email?: string | null } = {}): void {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    throw new BadRequestError(`Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_BYTES} octets`);
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    throw new BadRequestError("Ce mot de passe est trop courant, choisissez-en un autre");
  }

  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lowered.includes(localPart)) {
    throw new BadRequestError("Le mot de passe ne doit pas reprendre votre adresse e-mail");
  }
}
