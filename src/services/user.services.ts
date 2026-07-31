import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.config.js";
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../errors/index.js";
import {
  createMfaSecret,
  createOtpAuthUri,
  createQrCodeDataUri,
  isValidTotpCode,
  MFA_TOKEN_TTL,
} from "./mfa.service.js";

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
  mfa_secret: string | null;
  mfa_enabled: boolean;
  mfa_recovery_codes: string[];
  created_at: Date;
}

export type SafeUser = Omit<
  UserResult,
  "password_hash" | "invitation_token" | "invitation_token_expires" | "mfa_secret" | "mfa_recovery_codes"
>;

export interface MfaSetupResult {
  message: string;
  requireMfaSetup: true;
  mfaToken: string;
  userId: number;
  email: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export type LoginResult =
  | { status: "mfa"; requireMfa: true; mfaToken: string; userId: number }
  | (MfaSetupResult & { status: "mfa-setup" })
  | { status: "success"; requireMfa: false; user: SafeUser; token: string };

export type JwtPayload = {
  userId: number;
  userTypeId: number;
  email: string;
};

export type MfaTokenPayload = {
  userId: number;
  isMfaPending: true;
};

function toSafeUser(u: UserResult): SafeUser {
  const { password_hash, invitation_token, invitation_token_expires, mfa_secret, mfa_recovery_codes, ...safe } = u;
  return safe;
}

function signAccessToken(user: UserResult): string {
  const jwtPayload: JwtPayload = {
    userId: user.id,
    userTypeId: user.user_type_id,
    email: user.email,
  };

  return jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

function signMfaToken(userId: number): string {
  const payload: MfaTokenPayload = { userId, isMfaPending: true };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: MFA_TOKEN_TTL });
}

function extractMfaPendingUserId(token: string): number {
  let decoded: Partial<MfaTokenPayload>;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as Partial<MfaTokenPayload>;
  } catch {
    throw new UnauthorizedError("Token MFA invalide ou expiré");
  }

  if (!decoded.isMfaPending || typeof decoded.userId !== "number") {
    throw new UnauthorizedError("Token MFA invalide ou expiré");
  }

  return decoded.userId;
}

async function ensureMfaSecret(user: UserResult): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
  const secret = user.mfa_secret ?? createMfaSecret();

  if (!user.mfa_secret) {
    await prisma.user.update({ where: { id: user.id }, data: { mfa_secret: secret } });
  }

  const otpauthUrl = createOtpAuthUri(secret, user.email);
  const qrCodeDataUrl = await createQrCodeDataUri(otpauthUrl);

  return { otpauthUrl, qrCodeDataUrl };
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

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password_hash: null,
      user_type_id: 2,
      is_active: false,
    },
  }) as unknown as UserResult;

  return toSafeUser(user);
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

export async function setPassword(email: string, password: string): Promise<MfaSetupResult> {
  if (password.length < 8) {
    throw new BadRequestError("Le mot de passe doit contenir au moins 8 caractères");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Aucun compte trouvé avec cet email");
  }

  if (user.password_hash) {
    throw new BadRequestError("Ce compte a déjà un mot de passe");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
      is_active: true,
    },
  }) as unknown as UserResult;

  const { otpauthUrl, qrCodeDataUrl } = await ensureMfaSecret(updated);

  return {
    message: "Compte créé. L'activation du MFA est obligatoire : scannez le QR Code puis validez-le.",
    requireMfaSetup: true,
    mfaToken: signMfaToken(updated.id),
    userId: updated.id,
    email: updated.email,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
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

  if (user.mfa_enabled) {
    return {
      status: "mfa",
      requireMfa: true,
      mfaToken: signMfaToken(user.id),
      userId: user.id,
    };
  }

  const { otpauthUrl, qrCodeDataUrl } = await ensureMfaSecret(user);

  return {
    status: "mfa-setup",
    message: "L'activation du MFA est obligatoire avant de pouvoir vous connecter.",
    requireMfaSetup: true,
    mfaToken: signMfaToken(user.id),
    userId: user.id,
    email: user.email,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export async function confirmMfaSetup(mfaToken: string, code: string): Promise<{ user: SafeUser; token: string }> {
  const userId = extractMfaPendingUserId(mfaToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  if (!user.mfa_secret) {
    throw new BadRequestError("Aucune configuration MFA en attente pour ce compte");
  }

  if (user.mfa_enabled) {
    throw new BadRequestError("Le MFA est déjà activé sur ce compte");
  }

  if (!isValidTotpCode(code, user.mfa_secret)) {
    throw new UnauthorizedError("Code de vérification invalide");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { mfa_enabled: true },
  }) as unknown as UserResult;

  return { user: toSafeUser(updated), token: signAccessToken(updated) };
}

export async function verifyMfa(mfaToken: string, code: string): Promise<{ user: SafeUser; token: string }> {
  const userId = extractMfaPendingUserId(mfaToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  if (!user.mfa_secret || !user.mfa_enabled) {
    throw new BadRequestError("Le MFA n'est pas activé sur ce compte");
  }

  if (!isValidTotpCode(code, user.mfa_secret)) {
    throw new UnauthorizedError("Code de vérification invalide");
  }

  return { user: toSafeUser(user), token: signAccessToken(user) };
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

export async function deleteAdmin(adminId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: adminId } }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Administrateur");
  }

  if (user.user_type_id !== 2) {
    throw new BadRequestError("Seuls les administrateurs peuvent être supprimés");
  }

  await prisma.user.delete({ where: { id: adminId } });
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
