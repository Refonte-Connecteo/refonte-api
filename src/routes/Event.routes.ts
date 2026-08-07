import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
} from "../controllers/Event.controller.js";
import { eventCreateSchema, eventUpdateSchema } from "../validations/event.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllEvents);
router.get("/:id", handleGetEvent);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(eventCreateSchema), handleCreateEvent);
router.put("/:id", authenticate, requireAdmin, validate(eventUpdateSchema), handleUpdateEvent);
router.delete("/:id", authenticate, requireAdmin, handleDeleteEvent);

export default router;
