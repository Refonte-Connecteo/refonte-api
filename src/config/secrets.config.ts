/**
 * Validation pure des secrets (aucun effet de bord au chargement).
 * Testable unitairement sans dépendre de process.env.
 */

/**
 * Secrets JWT connus / par défaut qui ne doivent JAMAIS être utilisés en
 * production (ni ailleurs). Retrouvables dans les exemples, tutoriels et
 * anciens commits : les accepter rendrait les tokens forgables.
 */
const KNOWN_WEAK_JWT_SECRETS = new Set([
  "",
  "change-me-to-a-random-secret-key-in-production",
  "change-me",
  "your-secret-key",
  "your-secret-key-change-me-in-production",
  "secret",
  "supersecret",
  "super-secret",
  "jwt-secret",
  "jwt_secret",
  "changeme",
  "change-me-please",
  "this-is-a-secret",
  "0123456789abcdef0123456789abcdef",
  "a".repeat(32),
  "b".repeat(32),
  "0".repeat(32),
  "1".repeat(32),
  "f".repeat(32),
  "x".repeat(32),
  "-".repeat(32),
  ".".repeat(32),
]);

export function isKnownWeakJwtSecret(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();
  if (KNOWN_WEAK_JWT_SECRETS.has(normalized)) {
    return true;
  }
  // Motif "change-me"/"changeme"/"change_me" présent n'importe où dans la valeur
  if (/change[-_ ]?me/i.test(secret)) {
    return true;
  }
  // Valeur entièrement composée de caractères répétés (a-z0-9.)
  if (secret.length > 0 && /^([a-zA-Z0-9.-])\1*$/.test(secret)) {
    return true;
  }
  return false;
}

/**
 * Le secret JWT doit contenir au moins 32 caractères cryptographiques (>= 256 bits)
 * et ne pas être une clé connue/par défaut (placeholder). Le serveur refuse de
 * démarrer sinon.
 */
export function assertStrongJwtSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is too weak: it must contain at least 32 cryptographic characters (>= 256 bits). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  if (isKnownWeakJwtSecret(secret)) {
    throw new Error(
      "JWT_SECRET is a known/placeholder default value. It must be a unique cryptographic secret " +
        "(>= 256 bits). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
}

/** Empêche la réutilisation d'un même secret entre JWT et chiffrement PII. */
export function assertNoSecretReuse(jwtSecret: string, encryptionKey: string): void {
  if (jwtSecret && encryptionKey && jwtSecret === encryptionKey) {
    throw new Error(
      "JWT_SECRET and ENCRYPTION_KEY must be distinct secrets (reusing a key weakens both systems).",
    );
  }
}
