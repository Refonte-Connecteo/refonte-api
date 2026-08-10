import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateRequest, stringSchema } from "../middlewares/validation.middleware.js";
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
]);

// Public route - contact form submission
router.post("/", createContactMessageValidation, handleCreateContactMessage);

// Admin only routes
router.get("/", authenticate, requireAdmin, handleGetAllContactMessages);
router.get("/:id", authenticate, requireAdmin, handleGetContactMessage);
router.put("/:id/read", authenticate, requireAdmin, handleMarkAsRead);
router.delete("/:id", authenticate, requireAdmin, handleDeleteContactMessage);

export default router;
