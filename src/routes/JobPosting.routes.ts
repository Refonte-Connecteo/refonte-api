import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllJobPostings,
  handleGetJobPosting,
  handleCreateJobPosting,
  handleUpdateJobPosting,
  handleDeleteJobPosting,
} from "../controllers/JobPosting.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllJobPostings);
router.get("/:id", handleGetJobPosting);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateJobPosting);
router.put("/:id", authenticate, requireAdmin, handleUpdateJobPosting);
router.delete("/:id", authenticate, requireAdmin, handleDeleteJobPosting);

export default router;
