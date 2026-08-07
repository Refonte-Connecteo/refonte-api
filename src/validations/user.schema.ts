import { z } from "zod";

const email = z.string().email("Email invalide").max(255);
const username = z.string().min(1, "Username requis").max(100);
const password = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre");

export const inviteAdminSchema = z.object({ email, username });

export const setPasswordSchema = z.object({
  email,
  password,
  token: z.string().uuid("Token invalide"),
});

export const loginSchema = z.object({ email, password: z.string().min(1, "Mot de passe requis") });

export const checkPendingSchema = z.object({ email });
