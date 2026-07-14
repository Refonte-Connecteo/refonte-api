import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllKpiStats,
  handleGetKpiStat,
  handleCreateKpiStat,
  handleUpdateKpiStat,
  handleDeleteKpiStat,
} from "../controllers/Kpistat.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllKpiStats);
router.get("/:id", handleGetKpiStat);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateKpiStat);
router.put("/:id", authenticate, requireAdmin, handleUpdateKpiStat);
router.delete("/:id", authenticate, requireAdmin, handleDeleteKpiStat);

export default router;