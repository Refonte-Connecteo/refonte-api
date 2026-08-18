import { randomBytes, timingSafeEqual } from "node:crypto";
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
import {
  logAuditEvent,
  AuditEventType,
  errorCodeFrom,
  type AuditMeta,
  type AuditEventInput,
} from "./audit.service.js";

const BCRYPT_ROUNDS = 12;

/** Durée de validité du lien d'invitation (72 h). */
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

/** Comparaison à temps constant pour les jetons d'invitation. */
function secureTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Contexte d'audit optionnel transmis depuis le contrôleur (requête + acteur). */
export interface AuditContext {
  meta?: AuditMeta | null;
  actorUserId?: number | null;
  actorEmail?: string | null;
}

async function withAudit<T>(
  ctx: AuditContext | undefined,
  buildEvent: (success: boolean, error?: unknown) => Omit<AuditEventInput, "meta" | "actorUserId" | "actorEmail">,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    void logAuditEvent({ ...buildEvent(true), meta: ctx?.meta, actorUserId: ctx?.actorUserId, actorEmail: ctx?.actorEmail });
    return result;
  } catch (error) {
    void logAuditEvent({ ...buildEvent(false, error), meta: ctx?.meta, actorUserId: ctx?.actorUserId, actorEmail: ctx?.actorEmail });
    throw error;
  }
}

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
  mfa_secret: string | null;
  mfa_enabled: boolean;
  mfa_recovery_codes: string[];
  token_version: number;
  force_password_change: boolean;
  last_login_at: Date | null;
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

/** Résultat d'une invitation : compte créé + jeton d'activation à transmettre. */
export interface AdminInvitedResult {
  user: SafeUser;
  invitation_token: string;
  invitation_token_expires: Date;
}

export type LoginResult =
  | { status: "mfa"; requireMfa: true; mfaToken: string; userId: number; forcePasswordChange: boolean }
  | (MfaSetupResult & { status: "mfa-setup" })
  | { status: "success"; requireMfa: false; user: SafeUser; token: string; refreshToken: string; forcePasswordChange: boolean };

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
  forcePasswordChange: boolean;
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

export async function inviteAdmin(email: string, username: string, ctx?: AuditContext): Promise<AdminInvitedResult> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.ADMIN_INVITED,
    action: "Invitation d'un administrateur",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    details: { email, username },
  }), async () => {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictError("Un utilisateur avec cet email existe d├®j├á");
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new ConflictError("Ce nom d'utilisateur est d├®j├á pris");
    }

    const invitation_token = randomBytes(32).toString("hex");
    const invitation_token_expires = new Date(Date.now() + INVITATION_TTL_MS);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password_hash: null,
        user_type_id: 2,
        is_active: false,
        invitation_token,
        invitation_token_expires,
      },
    }) as unknown as UserResult;

    return { user: toSafeUser(user), invitation_token, invitation_token_expires };
  });
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

  if (!user.invitation_token || !user.invitation_token_expires) {
    throw new BadRequestError("Aucun lien d'activation n'a ├®t├® ├®mis pour ce compte.");
  }

  if (user.invitation_token_expires < new Date()) {
    throw new BadRequestError("Le lien d'invitation a expir├®. Contactez un super administrateur.");
  }

  return toSafeUser(user);
}

export async function setPassword(email: string, password: string, invitationToken: string, ctx?: AuditContext): Promise<MfaSetupResult> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.PASSWORD_SET,
    action: "Définition du mot de passe initial",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    details: { email },
  }), async () => {
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

    if (!user.invitation_token || !invitationToken || !secureTokenEqual(invitationToken, user.invitation_token)) {
      throw new UnauthorizedError("Le lien d'activation est invalide ou a d├®j├á ├®t├® utilis├®");
    }

    if (!user.invitation_token_expires || user.invitation_token_expires < new Date()) {
      throw new UnauthorizedError("Le lien d'activation a expir├®");
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
  });
}

export async function login(email: string, password: string, ctx?: AuditContext): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { user_type: true },
  }) as unknown as (UserResult & { user_type: { id: number; type: string } }) | null;

  const logFailedLogin = async (error: unknown): Promise<void> => {
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_FAILED,
      action: "Tentative de connexion",
      success: false,
      statusCode: 401,
      errorCode: errorCodeFrom(error, "LOGIN_FAILED"),
      actorEmail: email,
      details: { email },
      meta: ctx?.meta,
    });
  };

  if (!user) {
    await logFailedLogin(new UnauthorizedError("Email ou mot de passe incorrect"));
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  if (!user.is_active) {
    await logFailedLogin(new ForbiddenError("Ce compte n'est pas actif"));
    throw new ForbiddenError("Ce compte n'est pas actif");
  }

  if (!user.password_hash) {
    await logFailedLogin(new UnauthorizedError("Vous devez d'abord d├®finir votre mot de passe via le lien d'invitation"));
    throw new UnauthorizedError("Vous devez d'abord d├®finir votre mot de passe via le lien d'invitation");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    await logFailedLogin(new UnauthorizedError("Email ou mot de passe incorrect"));
    throw new UnauthorizedError("Email ou mot de passe incorrect");
  }

  if (user.mfa_enabled) {
    void logAuditEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      action: "Connexion réussie",
      success: true,
      statusCode: 200,
      actorUserId: user.id,
      actorEmail: user.email,
      details: { mfaRequired: true },
      meta: ctx?.meta,
    });
    return {
      status: "mfa",
      requireMfa: true,
      mfaToken: signMfaToken(user.id),
      userId: user.id,
      forcePasswordChange: user.force_password_change,
    };
  }

  const { otpauthUrl, qrCodeDataUrl } = await ensureMfaSecret(user);

  void logAuditEvent({
    eventType: AuditEventType.LOGIN_SUCCESS,
    action: "Connexion réussie",
    success: true,
    statusCode: 200,
    actorUserId: user.id,
    actorEmail: user.email,
    details: { mfaSetupRequired: true },
    meta: ctx?.meta,
  });

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

export async function confirmMfaSetup(mfaToken: string, code: string, ctx?: AuditContext): Promise<AuthResult> {
  return withAudit(ctx, (success, error) => ({
    eventType: success ? AuditEventType.MFA_SETUP : AuditEventType.MFA_SETUP_FAILED,
    action: "Activation du MFA",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    meta: ctx?.meta,
  }), async () => {
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
      data: { mfa_enabled: true, last_login_at: new Date() },
    }) as unknown as UserResult;

    return {
      user: toSafeUser(updated),
      token: signAccessToken(updated),
      refreshToken: signRefreshToken(updated),
      forcePasswordChange: updated.force_password_change,
    };
  });
}

export async function verifyMfa(mfaToken: string, code: string, ctx?: AuditContext): Promise<AuthResult> {
  return withAudit(ctx, (success, error) => ({
    eventType: success ? AuditEventType.MFA_VERIFY_SUCCESS : AuditEventType.MFA_VERIFY_FAILED,
    action: "Vérification MFA",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
  }), async () => {
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

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    return { user: toSafeUser(user), token: signAccessToken(user), refreshToken: signRefreshToken(user), forcePasswordChange: user.force_password_change };
  });
}

export async function getAllAdmins(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    where: { user_type_id: 2 },
    orderBy: { created_at: "desc" },
  }) as unknown as UserResult[];

  return users.map(toSafeUser);
}

export async function deactivateAdmin(adminId: number, ctx?: AuditContext): Promise<SafeUser> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.ADMIN_DEACTIVATED,
    action: "Désactivation d'un administrateur",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(adminId),
  }), async () => {
    const user = await prisma.user.findUnique({ where: { id: adminId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Administrateur");
    }

    if (ctx?.actorUserId === adminId) {
      throw new ForbiddenError("Vous ne pouvez pas d├®sactiver votre propre compte");
    }

    if (user.user_type_id !== 2) {
      throw new BadRequestError("Seuls les administrateurs peuvent ├¬tre d├®sactiv├®s");
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data: { is_active: false },
    }) as unknown as UserResult;

    return toSafeUser(updated);
  });
}

export async function deleteAdmin(adminId: number, ctx?: AuditContext): Promise<void> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.ADMIN_DELETED,
    action: "Suppression définitive d'un administrateur",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(adminId),
  }), async () => {
    const user = await prisma.user.findUnique({ where: { id: adminId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Administrateur");
    }

    if (ctx?.actorUserId === adminId) {
      throw new ForbiddenError("Vous ne pouvez pas supprimer votre propre compte");
    }

    if (user.user_type_id !== 2) {
      throw new BadRequestError("Seuls les administrateurs peuvent ├¬tre supprim├®s");
    }

    await prisma.user.delete({ where: { id: adminId } });
  });
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

export async function changePassword(userId: number, newPassword: string, ctx?: AuditContext): Promise<void> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.PASSWORD_CHANGED,
    action: "Changement de mot de passe",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(userId),
  }), async () => {
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
  });
}

export async function forceChangePassword(userId: number, newPassword: string, ctx?: AuditContext): Promise<{ token: string; refreshToken: string }> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.PASSWORD_CHANGED,
    action: "Changement de mot de passe forcé (premier login)",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(userId),
  }), async () => {
    if (newPassword.length < 8) {
      throw new BadRequestError("Le mot de passe doit contenir au moins 8 caractères");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Utilisateur");
    }

    if (!user.force_password_change) {
      throw new BadRequestError("Aucun changement de mot de passe obligatoire en cours");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash!);
    if (isSamePassword) {
      throw new BadRequestError("Le nouveau mot de passe doit être différent de l'ancien");
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: hashedPassword,
        force_password_change: false,
      },
    }) as unknown as UserResult;

    await revokeAllTokensForUser(userId);

    const fresh = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult;

    return {
      token: signAccessToken(fresh),
      refreshToken: signRefreshToken(fresh),
    };
  });
}

export async function disableMfa(userId: number, ctx?: AuditContext): Promise<SafeUser> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.MFA_DISABLED,
    action: "Désactivation du MFA",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(userId),
  }), async () => {
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
  });
}

export async function logout(userId: number, token: string, ctx?: AuditContext): Promise<void> {
  await revokeToken(token, userId);
  void logAuditEvent({
    eventType: AuditEventType.LOGOUT,
    action: "Déconnexion",
    success: true,
    actorUserId: userId,
    actorEmail: ctx?.actorEmail,
    meta: ctx?.meta,
  });
}

export async function refreshAccessToken(refreshToken: string, ctx?: AuditContext): Promise<{ token: string; refreshToken: string }> {
  return withAudit(ctx, (success, error) => ({
    eventType: success ? AuditEventType.TOKEN_REFRESH : AuditEventType.TOKEN_REFRESH_FAILED,
    action: "Renouvellement de jeton",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
  }), async () => {
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
  });
}
