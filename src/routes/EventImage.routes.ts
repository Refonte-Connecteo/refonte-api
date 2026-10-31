import { Router } from "express";
import { authenticate, optionalAuthenticate, requireAdmin } from "../middlewares/auth.middleware.js";
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
router.get("/", optionalAuthenticate(), handleGetAllEventImages);
router.get("/event/:eventId", optionalAuthenticate(), handleGetEventImagesByEventId);
router.get("/:id", optionalAuthenticate(), handleGetEventImage);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(eventImageCreateSchema), handleCreateEventImage);
router.put("/:id", authenticate, requireAdmin, validate(eventImageUpdateSchema), handleUpdateEventImage);
router.delete("/:id", authenticate, requireAdmin, handleDeleteEventImage);

export default router;
