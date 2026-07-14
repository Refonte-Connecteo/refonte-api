import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllEventImages,
  handleGetEventImage,
  handleGetEventImagesByEventId,
  handleCreateEventImage,
  handleUpdateEventImage,
  handleDeleteEventImage,
} from "../controllers/EventImage.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllEventImages);
router.get("/:id", handleGetEventImage);
router.get("/event/:eventId", handleGetEventImagesByEventId);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateEventImage);
router.put("/:id", authenticate, requireAdmin, handleUpdateEventImage);
router.delete("/:id", authenticate, requireAdmin, handleDeleteEventImage);

export default router;
