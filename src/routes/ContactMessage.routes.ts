import { Router } from "express";
import { publicFormLimiter } from "../middlewares/rateLimit.js";
import { body } from "express-validator";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateRequest, stringSchema, rejectUnknownBodyFields, honeypot } from "../middlewares/validation.middleware.js";
import { isPrivateFileRef } from "../utils/privateFiles.js";
import {
  handleGetAllContactMessages,
  handleGetContactMessage,
  handleCreateContactMessage,
  handleMarkAsRead,
  handleDeleteContactMessage,
} from "../controllers/ContactMessage.controller.js";

const router = Router();

const createContactMessageValidation = validateRequest([
  stringSchema("first_name", { max: 100 }),
  stringSchema("last_name", { max: 100 }),
  body("email").trim().isEmail().withMessage("Email invalide"),
  stringSchema("phone", { optional: true, max: 30 }),
  stringSchema("company", { optional: true, max: 200 }),
  stringSchema("country", { optional: true, max: 100 }),
  stringSchema("message", { max: 5000 }),
  // Uniquement un fichier déposé via /api/upload/contact : jamais un fichier du site ni une URL externe.
  stringSchema("attachment_url", { optional: true, max: 500 })
    .custom(isPrivateFileRef)
    .withMessage("attachment_url invalide : utilisez l'adresse renvoyée par /api/upload/contact"),
]);

// Minimisation RGPD : seuls les champs strictement nécessaires sont acceptés.
const CONTACT_MESSAGE_ALLOWED_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "country",
  "message",
  "attachment_url",
] as const;

// Public route - contact form submission
router.post(
  "/",
  publicFormLimiter,
  honeypot,
  rejectUnknownBodyFields(CONTACT_MESSAGE_ALLOWED_FIELDS),
  createContactMessageValidation,
  handleCreateContactMessage,
);

// Admin only routes
router.get("/", authenticate, requireAdmin, handleGetAllContactMessages);
router.get("/:id", authenticate, requireAdmin, handleGetContactMessage);
router.put("/:id/read", authenticate, requireAdmin, handleMarkAsRead);
router.delete("/:id", authenticate, requireAdmin, handleDeleteContactMessage);

export default router;
