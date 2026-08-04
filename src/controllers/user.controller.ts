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

  const user = await inviteAdmin(email, username);
  res.status(201).json({ message: "Admin invité avec succès", user });
});

export const handleCheckPending = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email requis" });
    return;
  }

  const user = await checkPendingAdmin(email);
  res.json({ message: "Compte en attente trouvé", user });
});

export const handleSetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe sont requis" });
    return;
  }

  const result = await setPassword(email, password);
  res.status(201).json(result);
});

export const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe sont requis" });
    return;
  }

  const result = await login(email, password);

  if (result.status === "mfa") {
    res.status(200).json({
      message: "Veuillez fournir votre code de vérification MFA",
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
  res.json({ message: "Connexion réussie", user: result.user, token: result.token, refreshToken: result.refreshToken });
});

export const handleConfirmMfaSetup = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body ?? {};

  if (typeof mfaToken !== "string" || !mfaToken || !isSixDigitCode(code)) {
    res.status(400).json({ error: "mfaToken et code (6 chiffres) sont requis" });
    return;
  }

  const result = await confirmMfaSetup(mfaToken, code);
  setRefreshTokenCookie(res, result.refreshToken);
  res.json({
    message: "MFA activé avec succès",
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

  const result = await verifyMfa(mfaToken, code);
  setRefreshTokenCookie(res, result.refreshToken);
  res.json({
    message: "Connexion réussie",
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

  const result = await refreshAccessToken(refreshToken);
  setRefreshTokenCookie(res, result.refreshToken);
  res.json(result);
});

export const handleLogout = asyncHandler(async (req: Request, res: Response) => {
  const header = req.headers.authorization;

  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  if (!header || !header.startsWith("Bearer ")) {
    res.status(400).json({ error: "Token manquant ou invalide" });
    return;
  }

  await logout(req.user.userId, header.split(" ")[1]);

  const cookieToken = (req.cookies ?? {})[REFRESH_TOKEN_COOKIE] as string | undefined;
  if (typeof cookieToken === "string" && cookieToken) {
    await revokeToken(cookieToken, req.user.userId);
  }

  clearRefreshTokenCookie(res);
  res.json({ message: "Déconnexion réussie" });
});

export const handleChangePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { newPassword } = req.body ?? {};

  if (typeof newPassword !== "string" || !newPassword) {
    res.status(400).json({ error: "newPassword est requis" });
    return;
  }

  await changePassword(req.user.userId, newPassword);
  res.json({ message: "Mot de passe modifié avec succès. Vous devez vous reconnecter." });
});

export const handleDisableMfa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await disableMfa(req.user.userId);
  res.json({ message: "MFA désactivé avec succès", user });
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

  const user = await deactivateAdmin(id);
  res.json({ message: "Admin désactivé avec succès", user });
});

export const handleDeleteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  await deleteAdmin(id);
  res.json({ message: "Admin supprimé définitivement" });
});

export const handleGetProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await getProfile(req.user.userId);
  res.json({ user });
});
