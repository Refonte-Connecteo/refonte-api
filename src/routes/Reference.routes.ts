import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllReferences,
  handleGetReference,
  handleCreateReference,
  handleUpdateReference,
  handleDeleteReference,
} from "../controllers/Reference.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllReferences);
router.get("/:id", handleGetReference);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateReference);
router.put("/:id", authenticate, requireAdmin, handleUpdateReference);
router.delete("/:id", authenticate, requireAdmin, handleDeleteReference);

export default router;
