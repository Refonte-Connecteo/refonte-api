import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.config.js";
import { sendInvitationEmail } from "./email.service.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";

const BCRYPT_ROUNDS = 12;

export interface UserResult {
  id: number;
  email: string;
  username: string;
  password_hash: string | null;
  user_type_id: number;
  is_active: boolean;
  invitation_token: string | null;
  invitation_token_expires: Date | null;
  created_at: Date;
}

export type SafeUser = Omit<UserResult, "password_hash" | "invitation_token" | "invitation_token_expires">;

export type JwtPayload = {
  userId: number;
  userTypeId: number;
  email: string;
};

function toSafeUser(u: UserResult): SafeUser {
  const { password_hash, invitation_token, invitation_token_expires, ...safe } = u;
  return safe;
}

export async function inviteAdmin(email: string, username: string): Promise<SafeUser> {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new ConflictError("Un utilisateur avec cet email existe déjà");
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new ConflictError("Ce nom d'utilisateur est déjà pris");
  }

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + env.INVITATION_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password_hash: null,
      user_type_id: 2,
      is_active: false,
      invitation_token: token,
      invitation_token_expires: expires,
    },
  }) as unknown as UserResult;

  await sendInvitationEmail(email, token);

  return toSafeUser(user);
}

export async function setPassword(token: string, password: string): Promise<SafeUser> {
  if (password.length < 8) {
    throw new BadRequestError("Le mot de passe doit contenir au moins 8 caractères");
  }

  const user = await prisma.user.findFirst({
    where: {
      invitation_token: token,
      invitation_token_expires: { gte: new Date() },
    },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new BadRequestError("Token d'invitation invalide ou expiré");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
      invitation_token: null,
      invitation_token_expires: null,
      is_active: true,
    },
  }) as unknown as UserResult;

  return toSafeUser(updated);
}

export async function login(email: string, password: string): Promise<{ user: SafeUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { user_type: true },
  }) as unknown as (UserResult & { user_type: { id: number; type: string } }) | null;

  if (!user) {
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  if (!user.is_active) {
    throw new ForbiddenError("Ce compte n'est pas actif");
  }

  if (!user.password_hash) {
    throw new UnauthorizedError("Vous devez d'abord définir votre mot de passe via le lien d'invitation");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  const jwtPayload: JwtPayload = {
    userId: user.id,
    userTypeId: user.user_type_id,
    email: user.email,
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });

  return { user: toSafeUser(user), token };
}

export async function getAllAdmins(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    where: { user_type_id: 2 },
    orderBy: { created_at: "desc" },
  }) as unknown as UserResult[];

  return users.map(toSafeUser);
}

export async function deactivateAdmin(adminId: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: adminId } }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Administrateur");
  }

  if (user.user_type_id !== 2) {
    throw new BadRequestError("Seuls les administrateurs peuvent être désactivés");
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: { is_active: false },
  }) as unknown as UserResult;

  return toSafeUser(updated);
}

export async function getProfile(userId: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { user_type: true },
  }) as unknown as (UserResult & { user_type: { id: number; type: string } }) | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  return toSafeUser(user);
}
