import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllContactMessages,
  handleGetContactMessage,
  handleCreateContactMessage,
  handleMarkAsRead,
  handleDeleteContactMessage,
} from "../controllers/ContactMessage.controller.js";

const router = Router();

// Public route - contact form submission
router.post("/", handleCreateContactMessage);

// Admin only routes
router.get("/", authenticate, requireAdmin, handleGetAllContactMessages);
router.get("/:id", authenticate, requireAdmin, handleGetContactMessage);
router.put("/:id/read", authenticate, requireAdmin, handleMarkAsRead);
router.delete("/:id", authenticate, requireAdmin, handleDeleteContactMessage);

export default router;
