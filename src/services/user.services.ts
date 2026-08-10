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
import {
  signAccessToken,
  signRefreshToken,
  revokeToken,
  revokeAllTokensForUser,
  verifyRefreshToken,
  type RefreshTokenPayload,
} from "./token.service.js";

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
  token_version: number;
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
  | { status: "success"; requireMfa: false; user: SafeUser; token: string; refreshToken: string };

export type JwtPayload = {
  userId: number;
  userTypeId: number;
  email: string;
  tokenVersion: number;
  tokenType: "access" | "refresh";
};

export type TokenSubject = {
  id: number;
  user_type_id: number;
  email: string;
  token_version: number;
};

export type AuthResult = {
  user: SafeUser;
  token: string;
  refreshToken: string;
};

export type MfaTokenPayload = {
  userId: number;
  isMfaPending: true;
};

function toSafeUser(u: UserResult): SafeUser {
  const { password_hash, invitation_token, invitation_token_expires, mfa_secret, mfa_recovery_codes, ...safe } = u;
  return safe;
}

function signMfaToken(userId: number): string {
  const payload: MfaTokenPayload = { userId, isMfaPending: true };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: MFA_TOKEN_TTL,
  });
}

function extractMfaPendingUserId(token: string): number {
  let decoded: Partial<MfaTokenPayload>;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM],
    }) as unknown as Partial<MfaTokenPayload>;
  } catch {
    throw new UnauthorizedError("Token MFA invalide ou expir├®");
  }

  if (!decoded.isMfaPending || typeof decoded.userId !== "number") {
    throw new UnauthorizedError("Token MFA invalide ou expir├®");
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
    throw new ConflictError("Un utilisateur avec cet email existe d├®j├á");
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new ConflictError("Ce nom d'utilisateur est d├®j├á pris");
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
    throw new NotFoundError("Aucun compte trouv├® avec cet email");
  }

  if (user.user_type_id !== 2) {
    throw new BadRequestError("Cet email ne correspond pas ├á un administrateur");
  }

  if (user.is_active) {
    throw new BadRequestError("Ce compte est d├®j├á actif. Veuillez vous connecter.");
  }

  if (user.password_hash) {
    throw new BadRequestError("Ce compte a d├®j├á un mot de passe. Veuillez vous connecter.");
  }

  return toSafeUser(user);
}

export async function setPassword(email: string, password: string): Promise<MfaSetupResult> {
  if (password.length < 8) {
    throw new BadRequestError("Le mot de passe doit contenir au moins 8 caract├¿res");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Aucun compte trouv├® avec cet email");
  }

  if (user.password_hash) {
    throw new BadRequestError("Ce compte a d├®j├á un mot de passe");
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
    message: "Compte cr├®├®. L'activation du MFA est obligatoire : scannez le QR Code puis validez-le.",
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
    throw new UnauthorizedError("Vous devez d'abord d├®finir votre mot de passe via le lien d'invitation");
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

export async function confirmMfaSetup(mfaToken: string, code: string): Promise<AuthResult> {
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
    throw new BadRequestError("Le MFA est d├®j├á activ├® sur ce compte");
  }

  if (!isValidTotpCode(code, user.mfa_secret)) {
    throw new UnauthorizedError("Code de v├®rification invalide");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { mfa_enabled: true },
  }) as unknown as UserResult;

  return {
    user: toSafeUser(updated),
    token: signAccessToken(updated),
    refreshToken: signRefreshToken(updated),
  };
}

export async function verifyMfa(mfaToken: string, code: string): Promise<AuthResult> {
  const userId = extractMfaPendingUserId(mfaToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  if (!user.mfa_secret || !user.mfa_enabled) {
    throw new BadRequestError("Le MFA n'est pas activ├® sur ce compte");
  }

  if (!isValidTotpCode(code, user.mfa_secret)) {
    throw new UnauthorizedError("Code de v├®rification invalide");
  }

  return { user: toSafeUser(user), token: signAccessToken(user), refreshToken: signRefreshToken(user) };
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
    throw new BadRequestError("Seuls les administrateurs peuvent ├¬tre d├®sactiv├®s");
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
    throw new BadRequestError("Seuls les administrateurs peuvent ├¬tre supprim├®s");
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

export async function changePassword(userId: number, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new BadRequestError("Le mot de passe doit contenir au moins 8 caract├¿res");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: hashedPassword },
  });

  await revokeAllTokensForUser(userId);
}

export async function disableMfa(userId: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  if (!user.mfa_enabled) {
    throw new BadRequestError("Le MFA n'est pas activ├® sur ce compte");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      mfa_secret: null,
      mfa_enabled: false,
      mfa_recovery_codes: [],
    },
  }) as unknown as UserResult;

  await revokeAllTokensForUser(userId);

  return toSafeUser(updated);
}

export async function logout(userId: number, token: string): Promise<void> {
  await revokeToken(token, userId);
}

export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const decoded: RefreshTokenPayload = await verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  }) as unknown as UserResult | null;

  if (!user || !user.is_active) {
    throw new UnauthorizedError("Compte inactif ou introuvable");
  }

  if (user.token_version !== decoded.tokenVersion) {
    throw new UnauthorizedError("Token de rafra├«chissement r├®voqu├®");
  }

  await revokeToken(refreshToken, user.id);

  return { token: signAccessToken(user), refreshToken: signRefreshToken(user) };
}
