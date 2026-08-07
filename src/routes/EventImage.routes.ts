import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllEventImages,
  handleGetEventImage,
  handleGetEventImagesByEventId,
  handleCreateEventImage,
  handleUpdateEventImage,
  handleDeleteEventImage,
} from "../controllers/EventImage.controller.js";
import { eventImageCreateSchema, eventImageUpdateSchema } from "../validations/eventimage.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllEventImages);
router.get("/event/:eventId", handleGetEventImagesByEventId);
router.get("/:id", handleGetEventImage);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(eventImageCreateSchema), handleCreateEventImage);
router.put("/:id", authenticate, requireAdmin, validate(eventImageUpdateSchema), handleUpdateEventImage);
router.delete("/:id", authenticate, requireAdmin, handleDeleteEventImage);

export default router;
