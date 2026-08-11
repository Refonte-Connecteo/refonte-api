import type { Request, Response } from "express";
import {
  inviteAdmin,
  setPassword,
  login,
  getAllAdmins,
  deactivateAdmin,
  deleteAdmin,
  getProfile,
  checkPendingAdmin,
  confirmMfaSetup,
  verifyMfa,
  changePassword,
  disableMfa,
  logout,
  refreshAccessToken,
} from "../services/user.services.js";
import { isSixDigitCode } from "../services/mfa.service.js";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { revokeToken } from "../services/token.service.js";
import { buildAuditMeta, getAuditLogs } from "../services/audit.service.js";
import {
  REFRESH_TOKEN_COOKIE,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/cookies.js";

export const handleInviteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { email, username } = req.body;

  if (!email || !username) {
    res.status(400).json({ error: "Email et username sont requis" });
    return;
  }

  const user = await inviteAdmin(email, username, {
    meta: buildAuditMeta(req),
    actorUserId: req.user?.userId,
    actorEmail: req.user?.email,
  });
  res.status(201).json({
    message: "Admin invit├® avec succ├¿s",
    user: user.user,
    invitation_token: user.invitation_token,
    invitation_token_expires: user.invitation_token_expires,
  });
});

export const handleCheckPending = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email requis" });
    return;
  }

  const user = await checkPendingAdmin(email);
  res.json({ message: "Compte en attente trouv├®", user });
});

export const handleSetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, invitationToken } = req.body;

  if (!email || !password || !invitationToken) {
    res.status(400).json({ error: "Email, mot de passe et invitationToken sont requis" });
    return;
  }

  const result = await setPassword(email, password, invitationToken, { meta: buildAuditMeta(req) });
  res.status(201).json(result);
});

export const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe sont requis" });
    return;
  }

  const result = await login(email, password, { meta: buildAuditMeta(req) });

  if (result.status === "mfa") {
    res.status(200).json({
      message: "Veuillez fournir votre code de v├®rification MFA",
      requireMfa: true,
      mfaToken: result.mfaToken,
      userId: result.userId,
    });
    return;
  }

  if (result.status === "mfa-setup") {
    res.status(200).json(result);
    return;
  }

  setRefreshTokenCookie(res, result.refreshToken);
  res.json({ message: "Connexion r├®ussie", user: result.user, token: result.token, refreshToken: result.refreshToken });
});

export const handleConfirmMfaSetup = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body ?? {};

  if (typeof mfaToken !== "string" || !mfaToken || !isSixDigitCode(code)) {
    res.status(400).json({ error: "mfaToken et code (6 chiffres) sont requis" });
    return;
  }

  const result = await confirmMfaSetup(mfaToken, code, { meta: buildAuditMeta(req) });
  setRefreshTokenCookie(res, result.refreshToken);
  res.json({
    message: "MFA activ├® avec succ├¿s",
    user: result.user,
    token: result.token,
    refreshToken: result.refreshToken,
  });
});

export const handleVerifyMfa = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body ?? {};

  if (typeof mfaToken !== "string" || !mfaToken || !isSixDigitCode(code)) {
    res.status(400).json({ error: "mfaToken et code (6 chiffres) sont requis" });
    return;
  }

  const result = await verifyMfa(mfaToken, code, { meta: buildAuditMeta(req) });
  setRefreshTokenCookie(res, result.refreshToken);
  res.json({
    message: "Connexion r├®ussie",
    user: result.user,
    token: result.token,
    refreshToken: result.refreshToken,
  });
});

export const handleRefresh = asyncHandler(async (req: Request, res: Response) => {
  const bodyToken = (req.body ?? {}).refreshToken;
  const cookieToken = (req.cookies ?? {})[REFRESH_TOKEN_COOKIE] as string | undefined;

  const refreshToken =
    typeof bodyToken === "string" && bodyToken.trim() !== "" ? bodyToken : cookieToken;

  if (typeof refreshToken !== "string" || !refreshToken) {
    res.status(400).json({ error: "refreshToken requis" });
    return;
  }

  const result = await refreshAccessToken(refreshToken, { meta: buildAuditMeta(req) });
  setRefreshTokenCookie(res, result.refreshToken);
  res.json(result);
});

export const handleLogout = asyncHandler(async (req: Request, res: Response) => {
  const header = req.headers.authorization;

  if (!req.user) {
    res.status(401).json({ error: "Non authentifi├®" });
    return;
  }

  if (!header || !header.startsWith("Bearer ")) {
    res.status(400).json({ error: "Token manquant ou invalide" });
    return;
  }

  await logout(req.user.userId, header.split(" ")[1], {
    meta: buildAuditMeta(req),
    actorUserId: req.user.userId,
    actorEmail: req.user.email,
  });

  const cookieToken = (req.cookies ?? {})[REFRESH_TOKEN_COOKIE] as string | undefined;
  if (typeof cookieToken === "string" && cookieToken) {
    await revokeToken(cookieToken, req.user.userId);
  }

  clearRefreshTokenCookie(res);
  res.json({ message: "D├®connexion r├®ussie" });
});

export const handleChangePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifi├®" });
    return;
  }

  const { newPassword } = req.body ?? {};

  if (typeof newPassword !== "string" || !newPassword) {
    res.status(400).json({ error: "newPassword est requis" });
    return;
  }

  await changePassword(req.user.userId, newPassword, {
    meta: buildAuditMeta(req),
    actorUserId: req.user.userId,
    actorEmail: req.user.email,
  });
  res.json({ message: "Mot de passe modifi├® avec succ├¿s. Vous devez vous reconnecter." });
});

export const handleDisableMfa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifi├®" });
    return;
  }

  const user = await disableMfa(req.user.userId, {
    meta: buildAuditMeta(req),
    actorUserId: req.user.userId,
    actorEmail: req.user.email,
  });
  res.json({ message: "MFA d├®sactiv├® avec succ├¿s", user });
});

export const handleGetAllAdmins = asyncHandler(async (_req: Request, res: Response) => {
  const users = await getAllAdmins();
  res.json({ users });
});

export const handleDeactivateAdmin = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const user = await deactivateAdmin(id, {
    meta: buildAuditMeta(req),
    actorUserId: req.user?.userId,
    actorEmail: req.user?.email,
  });
  res.json({ message: "Admin d├®sactiv├® avec succ├¿s", user });
});

export const handleDeleteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  await deleteAdmin(id, {
    meta: buildAuditMeta(req),
    actorUserId: req.user?.userId,
    actorEmail: req.user?.email,
  });
  res.json({ message: "Admin supprim├® d├®finitivement" });
});

export const handleGetProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifi├®" });
    return;
  }

  const user = await getProfile(req.user.userId);
  res.json({ user });
});

export const handleGetAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const {
    page,
    pageSize,
    eventType,
    success,
    email,
    from,
    to,
  } = req.query as Record<string, string | undefined>;

  const result = await getAuditLogs({
    page: page !== undefined ? parseInt(page, 10) : undefined,
    pageSize: pageSize !== undefined ? parseInt(pageSize, 10) : undefined,
    eventType,
    success: success === undefined ? undefined : success === "true",
    email,
    from,
    to,
  });

  res.json(result);
});
