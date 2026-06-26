import type { Request, Response } from "express";
import {
  inviteAdmin,
  setPassword,
  login,
  getAllAdmins,
  deactivateAdmin,
  getProfile,
} from "../services/user.services.js";
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

export const handleSetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ error: "Token et mot de passe sont requis" });
    return;
  }

  const user = await setPassword(token, password);
  res.json({ message: "Mot de passe défini avec succès", user });
});

export const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe sont requis" });
    return;
  }

  const result = await login(email, password);
  res.json({ message: "Connexion réussie", ...result });
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

export const handleGetProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await getProfile(req.user.userId);
  res.json({ user });
});
