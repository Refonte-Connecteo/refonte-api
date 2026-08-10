import type { Request, Response } from "express";
import { env } from "../config/env.config.js";

/**
 * Vérifie qu'une URL de redirection est sûre :
 * - soit un chemin strictement relatif (commence par "/" mais pas par "//" ou "/\");
 * - soit une URL absolue (http/https) dont le domaine figure dans la liste
 *   blanche ALLOWED_REDIRECT_DOMAINS.
 */
export function isSafeRedirectUrl(
  targetUrl: string,
  allowedDomains: string[] = env.ALLOWED_REDIRECT_DOMAINS,
): boolean {
  if (typeof targetUrl !== "string" || targetUrl.trim() === "") {
    return false;
  }

  const candidate = targetUrl.trim();

  if (candidate.startsWith("/")) {
    if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
      return false;
    }
    return true;
  }

  if (allowedDomains.length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.host.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  return allowedDomains.some((domain) => {
    const normalized = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return host === normalized || hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

/**
 * Redirige vers `targetUrl` uniquement si celle-ci est autorisée.
 * Sinon répond 400 au lieu d'effectuer une redirection ouverte.
 */
export function safeRedirect(req: Request, res: Response, targetUrl: string): void {
  if (!isSafeRedirectUrl(targetUrl)) {
    res.status(400).json({ error: "Redirection non autorisée" });
    return;
  }
  res.redirect(targetUrl);
}
