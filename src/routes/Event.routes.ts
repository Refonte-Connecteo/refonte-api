import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
} from "../controllers/Event.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllEvents);
router.get("/:id", handleGetEvent);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateEvent);
router.put("/:id", authenticate, requireAdmin, handleUpdateEvent);
router.delete("/:id", authenticate, requireAdmin, handleDeleteEvent);

export default router;
