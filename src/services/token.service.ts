import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.config.js";
import { UnauthorizedError } from "../errors/index.js";
import type { JwtPayload, TokenSubject } from "./user.services.js";

export type RefreshTokenPayload = JwtPayload & {
  tokenType: "refresh";
  jti: string;
};

const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    return DEFAULT_REFRESH_TTL_MS;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return DEFAULT_REFRESH_TTL_MS;
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(user: TokenSubject): string {
  const payload: JwtPayload = {
    userId: user.id,
    userTypeId: user.user_type_id,
    email: user.email,
    tokenVersion: user.token_version,
    tokenType: "access",
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(user: TokenSubject): string {
  const payload: RefreshTokenPayload = {
    userId: user.id,
    userTypeId: user.user_type_id,
    email: user.email,
    tokenVersion: user.token_version,
    tokenType: "refresh",
    jti: randomBytes(32).toString("hex"),
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const found = await prisma.revoked_token.findUnique({
    where: { token_hash: tokenHash(token) },
  });
  return found !== null;
}

export async function revokeToken(token: string, userId: number | null): Promise<void> {
  await prisma.revoked_token.create({
    data: {
      token_hash: tokenHash(token),
      user_id: userId,
      expires_at: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });
}

export async function revokeAllTokensForUser(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { token_version: { increment: 1 } },
  });
  await prisma.revoked_token.deleteMany({ where: { user_id: userId } });
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  let decoded: RefreshTokenPayload;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM],
    }) as unknown as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError("Token de rafraîchissement invalide ou expiré");
  }

  if (decoded.tokenType !== "refresh") {
    throw new UnauthorizedError("Token de rafraîchissement invalide");
  }

  if (await isTokenRevoked(token)) {
    throw new UnauthorizedError("Token de rafraîchissement révoqué");
  }

  return decoded;
}
