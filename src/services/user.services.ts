import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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
  TooManyRequestsError,
} from "../errors/index.js";
import {
  createMfaSecret,
  createOtpAuthUri,
  createQrCodeDataUri,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
  MFA_TOKEN_TTL,
} from "./mfa.service.js";
import { assertPasswordPolicy } from "../utils/passwordPolicy.js";
import {
  signAccessToken,
  signRefreshToken,
  revokeToken,
  revokeAllTokensForUser,
  verifyRefreshToken,
  type RefreshTokenPayload,
  isTokenRevoked,
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
/** Lien de réinitialisation d'accès émis par un super administrateur : court, car il ouvre un compte existant. */
const ACCESS_RESET_TTL_MS = 60 * 60 * 1000;

/** Verrouillage : après 5 échecs (mot de passe ou code MFA), 15 min de blocage, prolongé à chaque nouvel échec. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Empreinte bcrypt factice, comparée quand le compte n'existe pas : la réponse prend alors le
 * même temps qu'avec un vrai compte (impossible de deviner les adresses existantes au chrono).
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(24).toString("hex"), BCRYPT_ROUNDS);

/** Message unique : ne révèle ni si le compte existe, ni s'il est inactif ou en attente. */
const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";
const INVALID_ACTIVATION_LINK = "Le lien d'activation est invalide, expiré ou a déjà été utilisé";

/** Adresse e-mail comparée sans tenir compte de la casse ni des espaces. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
    include: { user_type: true },
  }) as unknown as Promise<(UserResult & { user_type: { id: number; type: string } }) | null>;
}

/** Les liens d'invitation et de réinitialisation ne sont stockés en base que sous forme d'empreinte. */
function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Échec (mot de passe ou code MFA) : le compte est verrouillé 15 min au-delà de 5 échecs consécutifs. */
async function registerFailedAttempt(userId: number): Promise<void> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { failed_login_count: { increment: 1 } },
  });
  if (updated.failed_login_count >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { locked_until: new Date(Date.now() + LOCK_DURATION_MS) },
    });
  }
}

function assertNotLocked(user: { locked_until?: Date | null }): void {
  if (user.locked_until && user.locked_until > new Date()) {
    const minutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60_000);
    throw new TooManyRequestsError(`Trop de tentatives : réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`);
  }
}

/** Le jeton MFA (étape entre mot de passe et code) ne sert qu'une fois. */
async function assertMfaTokenUnused(mfaToken: string): Promise<void> {
  if (await isTokenRevoked(mfaToken)) {
    throw new UnauthorizedError("Token MFA invalide ou expiré");
  }
}

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
    await logAuditEvent({ ...buildEvent(true), meta: ctx?.meta, actorUserId: ctx?.actorUserId, actorEmail: ctx?.actorEmail });
    return result;
  } catch (error) {
    await logAuditEvent({ ...buildEvent(false, error), meta: ctx?.meta, actorUserId: ctx?.actorUserId, actorEmail: ctx?.actorEmail });
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
  failed_login_count?: number;
  locked_until?: Date | null;
  mfa_last_used_step?: number | null;
}

export type SafeUser = Omit<
  UserResult,
  | "password_hash"
  | "invitation_token"
  | "invitation_token_expires"
  | "mfa_secret"
  | "mfa_recovery_codes"
  | "failed_login_count"
  | "locked_until"
  | "mfa_last_used_step"
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
  /** Codes de secours en clair : renvoyés une seule fois, à l'activation du MFA. */
  recoveryCodes?: string[];
};

export type MfaTokenPayload = {
  userId: number;
  isMfaPending: true;
};

function toSafeUser(u: UserResult): SafeUser {
  const { password_hash, invitation_token, invitation_token_expires, mfa_secret, mfa_recovery_codes, failed_login_count, locked_until, mfa_last_used_step, ...safe } = u;
  return safe;
}

function signMfaToken(userId: number): string {
  const payload: MfaTokenPayload = { userId, isMfaPending: true };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: MFA_TOKEN_TTL,
    // Identifiant unique : deux connexions dans la même seconde donneraient sinon le même
    // jeton, et le second serait refusé comme déjà utilisé (jeton à usage unique).
    jwtid: randomBytes(16).toString("hex"),
  });
}

function extractMfaPendingUserId(token: string): number {
  let decoded: Partial<MfaTokenPayload>;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM],
    }) as unknown as Partial<MfaTokenPayload>;
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

export async function inviteAdmin(email: string, username: string, ctx?: AuditContext, userTypeId?: number): Promise<AdminInvitedResult> {
  const typeId = userTypeId === 1 ? 1 : 2;

  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.ADMIN_INVITED,
    action: "Invitation d'un administrateur",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    details: { email, username, user_type_id: typeId },
  }), async () => {
    email = normalizeEmail(email);
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      throw new ConflictError("Un utilisateur avec cet email existe déjà");
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new ConflictError("Ce nom d'utilisateur est déjà pris");
    }

    const invitation_token = randomBytes(32).toString("hex");
    const invitation_token_expires = new Date(Date.now() + INVITATION_TTL_MS);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password_hash: null,
        user_type_id: typeId,
        is_active: false,
        invitation_token: hashLinkToken(invitation_token),
        invitation_token_expires,
      },
    }) as unknown as UserResult;

    return { user: toSafeUser(user), invitation_token, invitation_token_expires };
  });
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
    assertPasswordPolicy(password, { email });

    const user = await findUserByEmail(email);

    // Une seule réponse pour un compte inconnu, déjà activé, un lien faux ou expiré :
    // la page ne révèle pas quelles adresses correspondent à un compte.
    const tokenMatches =
      !!user?.invitation_token &&
      !!invitationToken &&
      secureTokenEqual(hashLinkToken(invitationToken), user.invitation_token);

    if (!user || user.password_hash || !tokenMatches) {
      throw new UnauthorizedError(INVALID_ACTIVATION_LINK);
    }

    if (!user.invitation_token_expires || user.invitation_token_expires < new Date()) {
      throw new UnauthorizedError(INVALID_ACTIVATION_LINK);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        is_active: true,
        invitation_token: null,
        invitation_token_expires: null,
        failed_login_count: 0,
        locked_until: null,
      },
    }) as unknown as UserResult;

    const { otpauthUrl, qrCodeDataUrl } = await ensureMfaSecret(updated);

    return {
      message: "Mot de passe enregistré. L'activation du MFA est obligatoire : scannez le QR Code puis validez-le.",
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
  const user = await findUserByEmail(email);

  const logFailedLogin = async (error: unknown, reason: string): Promise<void> => {
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_FAILED,
      action: "Tentative de connexion",
      success: false,
      statusCode: error instanceof TooManyRequestsError ? 429 : 401,
      errorCode: errorCodeFrom(error, "LOGIN_FAILED"),
      actorEmail: email,
      // La raison précise reste dans le journal, jamais dans la réponse.
      details: { email, reason },
      meta: ctx?.meta,
    });
  };

  if (user) {
    try {
      assertNotLocked(user);
    } catch (err) {
      await logFailedLogin(err, "locked");
      throw err;
    }
  }

  // Toujours une vérification bcrypt, même sans compte : même durée de réponse dans tous les cas.
  const isValid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.is_active || !user.password_hash || !isValid) {
    const reason = !user ? "unknown_email" : !user.is_active ? "inactive" : !user.password_hash ? "no_password" : "bad_password";
    if (user && user.password_hash) {
      await registerFailedAttempt(user.id);
    }
    const err = new UnauthorizedError(INVALID_CREDENTIALS);
    await logFailedLogin(err, reason);
    throw err;
  }

  if (user.mfa_enabled) {
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      action: "Mot de passe vérifié, code MFA attendu",
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

  await logAuditEvent({
    eventType: AuditEventType.LOGIN_SUCCESS,
    action: "Mot de passe vérifié, activation du MFA attendue",
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
    await assertMfaTokenUnused(mfaToken);

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

    const step = verifyTotp(code, user.mfa_secret, user.mfa_last_used_step);
    if (step === null) {
      throw new UnauthorizedError("Code de vérification invalide");
    }

    const recoveryCodes = generateRecoveryCodes();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        mfa_enabled: true,
        last_login_at: new Date(),
        mfa_last_used_step: step,
        failed_login_count: 0,
        locked_until: null,
        mfa_recovery_codes: recoveryCodes.map(hashRecoveryCode),
      },
    }) as unknown as UserResult;
    await revokeToken(mfaToken, user.id);

    return {
      user: toSafeUser(updated),
      token: signAccessToken(updated),
      refreshToken: signRefreshToken(updated),
      forcePasswordChange: updated.force_password_change,
      recoveryCodes,
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
    await assertMfaTokenUnused(mfaToken);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Utilisateur");
    }

    if (!user.mfa_secret || !user.mfa_enabled) {
      throw new BadRequestError("Le MFA n'est pas activé sur ce compte");
    }

    assertNotLocked(user);

    // Un code déjà utilisé (même pas de temps de 30 s) est refusé : il ne peut pas être rejoué.
    const step = verifyTotp(code, user.mfa_secret, user.mfa_last_used_step);
    if (step === null) {
      await registerFailedAttempt(user.id);
      throw new UnauthorizedError("Code de vérification invalide");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), mfa_last_used_step: step, failed_login_count: 0, locked_until: null },
    });
    await revokeToken(mfaToken, user.id);

    return { user: toSafeUser(user), token: signAccessToken(user), refreshToken: signRefreshToken(user), forcePasswordChange: user.force_password_change };
  });
}

/**
 * Connexion avec un code de secours à la place du code TOTP. Chaque code ne sert qu'une fois :
 * la mise à jour conditionnelle (le code doit encore être présent) empêche deux usages simultanés.
 */
export async function verifyMfaRecoveryCode(mfaToken: string, recoveryCode: string, ctx?: AuditContext): Promise<AuthResult & { remainingRecoveryCodes: number }> {
  let remaining = 0;
  return withAudit(ctx, (success, error) => ({
    eventType: success ? AuditEventType.MFA_VERIFY_SUCCESS : AuditEventType.MFA_VERIFY_FAILED,
    action: "Vérification MFA par code de secours",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    details: { method: "recovery_code", ...(success ? { remaining } : {}) },
  }), async () => {
    const userId = extractMfaPendingUserId(mfaToken);
    await assertMfaTokenUnused(mfaToken);
    const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Utilisateur");
    }
    if (!user.mfa_secret || !user.mfa_enabled) {
      throw new BadRequestError("Le MFA n'est pas activé sur ce compte");
    }
    assertNotLocked(user);

    const hash = hashRecoveryCode(recoveryCode);
    const left = user.mfa_recovery_codes.filter((h) => h !== hash);
    const consumed = left.length < user.mfa_recovery_codes.length
      ? await prisma.user.updateMany({
          where: { id: user.id, mfa_recovery_codes: { has: hash } },
          data: { mfa_recovery_codes: left, last_login_at: new Date() },
        })
      : { count: 0 };

    if (consumed.count !== 1) {
      await registerFailedAttempt(user.id);
      throw new UnauthorizedError("Code de secours invalide ou déjà utilisé");
    }

    await prisma.user.update({ where: { id: user.id }, data: { failed_login_count: 0, locked_until: null } });
    await revokeToken(mfaToken, user.id);
    remaining = left.length;
    return {
      user: toSafeUser(user),
      token: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      forcePasswordChange: user.force_password_change,
      remainingRecoveryCodes: remaining,
    };
  });
}

/** Nouveaux codes de secours (les anciens deviennent inutilisables). Mot de passe vérifié par la route. */
export async function regenerateRecoveryCodes(userId: number, ctx?: AuditContext): Promise<string[]> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.MFA_RECOVERY_CODES_GENERATED,
    action: "Génération de nouveaux codes de secours",
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
      throw new BadRequestError("Activez d'abord la double authentification");
    }

    const codes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfa_recovery_codes: codes.map(hashRecoveryCode) },
    });
    return codes;
  });
}

export type AccessResetResult = {
  user: SafeUser;
  reset_token: string;
  reset_token_expires: Date;
};

/**
 * Mot de passe oublié ou téléphone perdu : un super administrateur réinitialise l'accès d'un admin.
 * Le mot de passe et le MFA sont effacés, toutes les sessions coupées, et un lien à usage unique
 * valable 1 h est émis : l'admin choisit un nouveau mot de passe puis réenregistre son application.
 * Le lien réutilise le parcours d'activation (/admin/set-password), déjà protégé et testé.
 */
export async function resetAdminAccess(targetId: number, ctx?: AuditContext): Promise<AccessResetResult> {
  return withAudit(ctx, (success, error) => ({
    eventType: AuditEventType.ADMIN_ACCESS_RESET,
    action: "Réinitialisation de l'accès d'un administrateur",
    success,
    errorCode: success ? undefined : errorCodeFrom(error),
    resourceType: "user",
    resourceId: String(targetId),
  }), async () => {
    const target = await prisma.user.findUnique({ where: { id: targetId } }) as unknown as UserResult | null;

    if (!target) {
      throw new NotFoundError("Administrateur");
    }
    if (ctx?.actorUserId === target.id) {
      throw new ForbiddenError("Pour votre propre compte, utilisez la page Sécurité & profil");
    }
    if (target.user_type_id !== 2) {
      throw new BadRequestError("Seul l'accès d'un administrateur peut être réinitialisé ici");
    }
    if (!target.is_active && target.password_hash) {
      throw new BadRequestError("Ce compte est désactivé");
    }

    const reset_token = randomBytes(32).toString("hex");
    const reset_token_expires = new Date(Date.now() + ACCESS_RESET_TTL_MS);

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        password_hash: null,
        mfa_secret: null,
        mfa_enabled: false,
        mfa_recovery_codes: [],
        force_password_change: false,
        failed_login_count: 0,
        locked_until: null,
        mfa_last_used_step: null,
        invitation_token: hashLinkToken(reset_token),
        invitation_token_expires: reset_token_expires,
      },
    }) as unknown as UserResult;
    await revokeAllTokensForUser(target.id);

    return { user: toSafeUser(updated), reset_token, reset_token_expires };
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
      throw new ForbiddenError("Vous ne pouvez pas désactiver votre propre compte");
    }

    if (user.user_type_id !== 2) {
      throw new BadRequestError("Seuls les administrateurs peuvent être désactivés");
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
      throw new BadRequestError("Seuls les administrateurs peuvent être supprimés");
    }

    await prisma.user.delete({ where: { id: adminId } });
  });
}

/**
 * Profil de l'utilisateur connecté. Les codes de secours ne sont jamais renvoyés :
 * seulement combien il en reste, pour l'inviter à en générer de nouveaux à temps.
 */
export async function getProfile(userId: number): Promise<SafeUser & { recovery_codes_remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { user_type: true },
  }) as unknown as (UserResult & { user_type: { id: number; type: string } }) | null;

  if (!user) {
    throw new NotFoundError("Utilisateur");
  }

  return { ...toSafeUser(user), recovery_codes_remaining: user.mfa_recovery_codes.length };
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
    const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Utilisateur");
    }

    assertPasswordPolicy(newPassword, { email: user.email });

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
    const user = await prisma.user.findUnique({ where: { id: userId } }) as unknown as UserResult | null;

    if (!user) {
      throw new NotFoundError("Utilisateur");
    }

    assertPasswordPolicy(newPassword, { email: user.email });

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

export async function disableMfa(userId: number, code: string, ctx?: AuditContext): Promise<SafeUser> {
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

    if (!user.mfa_enabled || !user.mfa_secret) {
      throw new BadRequestError("Le MFA n'est pas activé sur ce compte");
    }

    // Un mot de passe volé ne suffit pas : il faut aussi le code de l'application.
    if (verifyTotp(code, user.mfa_secret, user.mfa_last_used_step) === null) {
      throw new UnauthorizedError("Code de vérification invalide");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_secret: null,
        mfa_enabled: false,
        mfa_recovery_codes: [],
        mfa_last_used_step: null,
      },
    }) as unknown as UserResult;

    await revokeAllTokensForUser(userId);

    return toSafeUser(updated);
  });
}

export async function logout(userId: number, token: string, ctx?: AuditContext): Promise<void> {
  await revokeToken(token, userId);
  await logAuditEvent({
    eventType: AuditEventType.LOGOUT,
    action: "Déconnexion",
    success: true,
    actorUserId: userId,
    actorEmail: ctx?.actorEmail,
    meta: ctx?.meta,
  });
}

/** Déconnexion de tous les appareils : tous les jetons émis jusqu'ici deviennent invalides. */
export async function logoutAllSessions(userId: number, ctx?: AuditContext): Promise<void> {
  await revokeAllTokensForUser(userId);
  await logAuditEvent({
    eventType: AuditEventType.LOGOUT,
    action: "Déconnexion de toutes les sessions",
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
      throw new UnauthorizedError("Token de rafraîchissement révoqué");
    }

    await revokeToken(refreshToken, user.id);

    return { token: signAccessToken(user), refreshToken: signRefreshToken(user) };
  });
}
