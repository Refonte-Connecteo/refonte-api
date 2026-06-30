import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { envConfig } from '@/config/env.config';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  id: string;
  email: string;
  user_type_id: string;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase() as 's' | 'm' | 'h' | 'd';

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * multipliers[unit];
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, envConfig.serverConfig.jwtAccessSecret, {
    expiresIn: parseDuration(envConfig.serverConfig.jwtAccessExpiration),
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, envConfig.serverConfig.jwtRefreshSecret, {
    expiresIn: parseDuration(envConfig.serverConfig.jwtRefreshExpiration),
  });
}

function parseDurationToMs(duration: string): number {
  return parseDuration(duration) * 1000;
}

export function setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProduction = envConfig.serverConfig.nodeEnv === 'production';
  const accessMaxAge = parseDurationToMs(envConfig.serverConfig.jwtAccessExpiration);
  const refreshMaxAge = parseDurationToMs(envConfig.serverConfig.jwtRefreshExpiration);

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: accessMaxAge,
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: refreshMaxAge,
    path: '/',
  });
}
