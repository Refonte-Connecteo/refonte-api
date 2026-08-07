import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.config.js";
import { logger } from "../lib/logger.js";
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
  jti: string;
};

function toSafeUser(u: UserResult): SafeUser {
  const { password_hash, invitation_token, invitation_token_expires, ...safe } = u;
  return safe;
}

export async function inviteAdmin(email: string, username: string): Promise<SafeUser & { invitation_token: string }> {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new ConflictError("Un utilisateur avec cet email existe déjà");
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new ConflictError("Ce nom d'utilisateur est déjà pris");
  }

  const invitationToken = crypto.randomUUID();
  const invitationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password_hash: null,
      user_type_id: 2,
      is_active: false,
      invitation_token: invitationToken,
      invitation_token_expires: invitationTokenExpires,
    },
  }) as unknown as UserResult;

  logger.info({ email, username }, "Admin invité avec succès");

  return { ...toSafeUser(user), invitation_token: invitationToken };
}

export async function checkPendingAdmin(email: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { email },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Aucun compte trouvé avec cet email");
  }

  if (user.user_type_id !== 2) {
    throw new BadRequestError("Cet email ne correspond pas à un administrateur");
  }

  if (user.is_active) {
    throw new BadRequestError("Ce compte est déjà actif. Veuillez vous connecter.");
  }

  if (user.password_hash) {
    throw new BadRequestError("Ce compte a déjà un mot de passe. Veuillez vous connecter.");
  }

  return toSafeUser(user);
}

function validatePasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw new BadRequestError("Le mot de passe doit contenir au moins 8 caractères");
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestError("Le mot de passe doit contenir au moins une majuscule");
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestError("Le mot de passe doit contenir au moins une minuscule");
  }
  if (!/[0-9]/.test(password)) {
    throw new BadRequestError("Le mot de passe doit contenir au moins un chiffre");
  }
}

export async function setPassword(email: string, password: string, token?: string): Promise<SafeUser> {
  validatePasswordPolicy(password);

  const user = await prisma.user.findUnique({
    where: { email },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Aucun compte trouvé avec cet email");
  }

  if (user.password_hash) {
    throw new BadRequestError("Ce compte a déjà un mot de passe");
  }

  if (!token) {
    throw new BadRequestError("Token d'invitation requis");
  }

  if (user.invitation_token !== token) {
    throw new BadRequestError("Token d'invitation invalide");
  }

  if (!user.invitation_token_expires || user.invitation_token_expires < new Date()) {
    throw new BadRequestError("Token d'invitation expiré. Demandez une nouvelle invitation.");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
      is_active: true,
      invitation_token: null,
      invitation_token_expires: null,
    },
  }) as unknown as UserResult;

  logger.info({ email, userId: user.id }, "Mot de passe défini avec succès");

  return toSafeUser(updated);
}

export async function login(email: string, password: string): Promise<{ user: SafeUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { user_type: true },
  }) as unknown as (UserResult & { user_type: { id: number; type: string } }) | null;

  if (!user) {
    logger.warn({ email }, "Tentative de connexion échouée : utilisateur inconnu");
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  if (!user.is_active) {
    logger.warn({ email, userId: user.id }, "Tentative de connexion échouée : compte inactif");
    throw new ForbiddenError("Ce compte n'est pas actif");
  }

  if (!user.password_hash) {
    logger.warn({ email, userId: user.id }, "Tentative de connexion échouée : mot de passe non défini");
    throw new UnauthorizedError("Vous devez d'abord définir votre mot de passe via le lien d'invitation");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    logger.warn({ email, userId: user.id }, "Tentative de connexion échouée : mot de passe incorrect");
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  const jwtPayload: JwtPayload = {
    userId: user.id,
    userTypeId: user.user_type_id,
    email: user.email,
    jti: crypto.randomUUID(),
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });

  logger.info({ email, userId: user.id }, "Connexion réussie");

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

  logger.warn({ adminId, email: user.email }, "Admin désactivé");

  return toSafeUser(updated);
}

export async function deleteAdmin(adminId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: adminId } }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Administrateur");
  }

  if (user.user_type_id !== 2) {
    throw new BadRequestError("Seuls les administrateurs peuvent être supprimés");
  }

  await prisma.user.delete({ where: { id: adminId } });

  logger.warn({ adminId, email: user.email }, "Admin supprimé définitivement");
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
