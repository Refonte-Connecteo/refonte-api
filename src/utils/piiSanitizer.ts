/**
 * Masquage défensif des PII avant tout envoi vers un tiers (chatbot OpenRouter).
 *
 * Principe privacy by design (RGPD art. 25) : le LLM ne doit jamais recevoir
 * de donnée à caractère personnel en clair. sanitizePrompt() détecte et
 * remplace les e-mails, numéros de téléphone (formats français et
 * internationaux), numéros de sécurité sociale (NIR français) et numéros de
 * carte bancaire (validation Luhn) par des jetons neutres.
 */

export const EMAIL_TOKEN = "[EMAIL_REDACTED]";
export const PHONE_TOKEN = "[PHONE_REDACTED]";
export const SENSITIVE_TOKEN = "[SENSITIVE_REDACTED]";

/** E-mails : forme locale@domaine.tld. */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Numéro de sécurité sociale français (NIR, 15 chiffres) :
 * sexe [1278], année, mois (01-12), département (2 chiffres ou 2A/2B),
 * commune (3), ordre (3), clé (2). Séparateurs espace/point/tiret/slash tolérés.
 */
const NIR_PATTERN =
  /\b[1278][ .\-/]?\d{2}[ .\-/]?(?:0[1-9]|1[0-2])[ .\-/]?(?:\d{2}|2[aAbB])(?:[ .\-/]?\d{3}){2}[ .\-/]?\d{2}\b/g;

/** Carte bancaire groupée : 4 blocs de 4 chiffres (espaces, points ou tirets). */
const CREDIT_CARD_GROUPED_PATTERN = /\b(?:\d{4}[ .\-]){3}\d{4}\b/g;

/** Carte bancaire continue : 13 à 19 chiffres, retenue uniquement si valide (Luhn). */
const CREDIT_CARD_CONTINUOUS_PATTERN = /\b\d{13,19}\b/g;

/**
 * Téléphone international : préfixe + ou 00, indicatif (1-3 chiffres) puis
 * 8 à 12 chiffres séparés par 0 à 2 caractères (espaces, points, tirets,
 * parenthèses) — couvre p.ex. « +33 6 12 34 56 78 » et « +1 (555) 123-4567 ».
 */
const PHONE_INTERNATIONAL_PATTERN = /(?<![\d+])(?:\+|00)\d{1,3}(?:[ .\-()]{0,2}\d){8,12}/g;

/** Téléphone français national : 0X XX XX XX XX (séparateurs optionnels). */
const PHONE_FR_PATTERN = /(?<![\d+.])0[1-9](?:[ .\-]?\d{2}){4}(?!\d)/g;

/** Algorithme de Luhn : valide une suite de chiffres (cartes bancaires). */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (doubleDigit) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

/**
 * Remplace toute PII détectée dans `text` par des jetons neutres.
 * Ordre d'application choisi pour éviter les collisions entre motifs :
 * e-mails → NIR → cartes bancaires → téléphones internationaux → téléphones FR.
 */
export function sanitizePrompt(text: string): string {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  let sanitized = text.replace(EMAIL_PATTERN, EMAIL_TOKEN);
  sanitized = sanitized.replace(NIR_PATTERN, SENSITIVE_TOKEN);
  sanitized = sanitized.replace(CREDIT_CARD_GROUPED_PATTERN, SENSITIVE_TOKEN);
  sanitized = sanitized.replace(CREDIT_CARD_CONTINUOUS_PATTERN, (match) =>
    passesLuhn(match) ? SENSITIVE_TOKEN : match,
  );
  sanitized = sanitized.replace(PHONE_INTERNATIONAL_PATTERN, PHONE_TOKEN);
  sanitized = sanitized.replace(PHONE_FR_PATTERN, PHONE_TOKEN);

  return sanitized;
}

/** Indique si le texte contient au moins une PII détectable (avant masquage). */
export function containsPii(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  const detectors = [
    EMAIL_PATTERN,
    NIR_PATTERN,
    CREDIT_CARD_GROUPED_PATTERN,
    CREDIT_CARD_CONTINUOUS_PATTERN,
    PHONE_INTERNATIONAL_PATTERN,
    PHONE_FR_PATTERN,
  ];

  return detectors.some((pattern) => new RegExp(pattern.source).test(text));
}
