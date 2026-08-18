import type { Request, Response, NextFunction } from "express";
import { body, validationResult, type ValidationChain } from "express-validator";
import { logAuditEvent, buildAuditMeta, AuditEventType } from "../services/audit.service.js";

const MALICIOUS_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /<\/script>/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<svg[\s>]/i,
  /\bjavascript\s*:/i,
  /\bvbscript\s*:/i,
  /\bdata:\s*text\/html/i,
  /(?:on(?:error|load|unload|click|dblclick|mouseover|mouseout|mousedown|mouseup|focus|blur|change|submit|keydown|keyup|keypress|pointerdown|pointerup|pointermove|input|dragstart|drop|scroll))\s*=/i,
];

const HTML_ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&amp;": "&",
  "&#x3c;": "<",
  "&#x3e;": ">",
  "&#60;": "<",
  "&#62;": ">",
  "&#x2f;": "/",
  "&#47;": "/",
  "&#x3d;": "=",
  "&#61;": "=",
  "&#x3a;": ":",
  "&#58;": ":",
  "&colon;": ":",
  "&#x28;": "(",
  "&#40;": "(",
  "&#x29;": ")",
  "&#41;": ")",
};

export function decodePercentEncoding(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeForInspection(value: string): string {
  let decoded = value;
  for (const [entity, character] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.split(entity).join(character);
  }
  return decoded;
}

export function containsMaliciousInput(value: unknown): boolean {
  if (typeof value === "string") {
    const decoded = normalizeForInspection(decodePercentEncoding(value));
    return MALICIOUS_PATTERNS.some((pattern) => pattern.test(value) || pattern.test(decoded));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsMaliciousInput(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => containsMaliciousInput(item));
  }
  return false;
}

/**
 * Middleware global : rejette (400) toute requête dont le body, la query ou les
 * params contiennent un payload XSS manifeste (balises script, gestionnaires
 * d'événements, schémas javascript:/data:, encodages HTML/URL).
 */
export async function rejectMaliciousInput(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sources: unknown[] = [req.body, req.query, req.params];

  if (sources.some((source) => containsMaliciousInput(source))) {
    await logAuditEvent({
      eventType: AuditEventType.VALIDATION_REJECTED,
      action: "Contenu malveillant (XSS) détecté",
      success: false,
      statusCode: 400,
      errorCode: "MALICIOUS_INPUT",
      meta: buildAuditMeta(req),
    });
    res.status(400).json({ error: "Contenu malveillant détecté dans la requête" });
    return;
  }

  next();
}

/** Vérifie qu'une valeur ne contient aucune balise HTML. */
export function noHtmlTag(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  const normalized = normalizeForInspection(decodePercentEncoding(value));
  return !/<[^>]*>/.test(normalized);
}

/**
 * Exécute une liste de validations express-validator et répond 400 en JSON
 * si une erreur est détectée.
 */
export function validateRequest(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      void logAuditEvent({
        eventType: AuditEventType.VALIDATION_REJECTED,
        action: "Validation de requête rejetée",
        success: false,
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: {
          fields: errors.array().map((error) =>
            error.type === "field" ? error.path : "request",
          ),
        },
        meta: buildAuditMeta(req),
      });
      res.status(400).json({
        error: "Données invalides",
        details: errors.array().map((error) => ({
          field: error.type === "field" ? error.path : "request",
          message: error.msg,
        })),
      });
      return;
    }

    next();
  };
}

/** Chaîne de validation pour un champ texte strict (pas de balises HTML). */
export function stringSchema(
  field: string,
  { optional = false, min = 1, max = 5000 }: { optional?: boolean; min?: number; max?: number } = {},
): ValidationChain {
  let chain: ValidationChain = optional ? body(field).optional() : body(field);

  chain = chain
    .trim()
    .isString()
    .withMessage(`${field} doit être une chaîne de caractères`)
    .isLength({ min, max })
    .withMessage(`${field} doit contenir entre ${min} et ${max} caractères`)
    .custom(noHtmlTag)
    .withMessage(`${field} ne doit pas contenir de balises HTML`);

  return chain;
}
