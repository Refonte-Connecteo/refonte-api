import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.config.js";
import { generateTotpCode } from "../../src/services/mfa.service.js";

export const api = request(app);

export function signToken(
  userId: number,
  userTypeId: number,
  email: string,
  options: { tokenVersion?: number; tokenType?: "access" | "refresh" } = {},
): string {
  return jwt.sign(
    {
      userId,
      userTypeId,
      email,
      tokenVersion: options.tokenVersion ?? 0,
      tokenType: options.tokenType ?? "access",
    },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}

export interface CreateUserOptions {
  email?: string;
  username?: string;
  password?: string;
  userTypeId?: number;
  isActive?: boolean;
  mfaSecret?: string | null;
  mfaEnabled?: boolean;
}

export async function createUser(options: CreateUserOptions = {}): Promise<{
  id: number;
  email: string;
  username: string;
  password: string;
}> {
  const password = options.password ?? "Password123!";
  const email = options.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const username = options.username ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const created = await prisma.user.create({
    data: {
      email,
      username,
      password_hash: await bcrypt.hash(password, 12),
      user_type_id: options.userTypeId ?? 2,
      is_active: options.isActive ?? true,
      mfa_secret: options.mfaSecret === undefined ? null : options.mfaSecret,
      mfa_enabled: options.mfaEnabled ?? false,
    },
  });

  return { id: created.id, email, username, password };
}

export async function totpCodeFor(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfa_secret) {
    throw new Error("Aucun secret MFA trouvé pour cet utilisateur");
  }
  return generateTotpCode(user.mfa_secret);
}

export async function resetDatabase(): Promise<void> {
  await prisma.audit_log.deleteMany();
  await prisma.revoked_token.deleteMany();
  await prisma.page_view.deleteMany();
  await prisma.application.deleteMany();
  await prisma.spontaneous_application.deleteMany();
  await prisma.contact_message.deleteMany();
  await prisma.job_posting.deleteMany();
  await prisma.user.deleteMany();
}
