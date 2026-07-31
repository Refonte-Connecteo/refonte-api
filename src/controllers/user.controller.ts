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
} from "../services/user.services.js";
import { isSixDigitCode } from "../services/mfa.service.js";
import { asyncHandler } from "../middlewares/auth.middleware.js";

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

  res.json({ message: "Connexion réussie", user: result.user, token: result.token });
});

export const handleConfirmMfaSetup = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body ?? {};

  if (typeof mfaToken !== "string" || !mfaToken || !isSixDigitCode(code)) {
    res.status(400).json({ error: "mfaToken et code (6 chiffres) sont requis" });
    return;
  }

  const result = await confirmMfaSetup(mfaToken, code);
  res.json({ message: "MFA activé avec succès", user: result.user, token: result.token });
});

export const handleVerifyMfa = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body ?? {};

  if (typeof mfaToken !== "string" || !mfaToken || !isSixDigitCode(code)) {
    res.status(400).json({ error: "mfaToken et code (6 chiffres) sont requis" });
    return;
  }

  const result = await verifyMfa(mfaToken, code);
  res.json({ message: "Connexion réussie", user: result.user, token: result.token });
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
