import type { Response } from "express";

export const REFRESH_TOKEN_COOKIE = "refreshToken";

const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Options strictes pour le cookie de refresh token :
 * - httpOnly : inaccessible depuis JavaScript (protection XSS) ;
 * - secure   : uniquement transmis en HTTPS en production ;
 * - sameSite : 'strict' (protection CSRF).
 */
export function refreshCookieOptions(maxAgeMs: number = DEFAULT_REFRESH_TTL_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, refreshCookieOptions());
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}
