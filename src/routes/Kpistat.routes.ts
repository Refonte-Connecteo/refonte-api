import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllKpiStats,
  handleGetKpiStat,
  handleCreateKpiStat,
  handleUpdateKpiStat,
  handleDeleteKpiStat,
} from "../controllers/Kpistat.controller.js";
import { kpiStatCreateSchema, kpiStatUpdateSchema } from "../validations/kpistat.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllKpiStats);
router.get("/:id", handleGetKpiStat);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(kpiStatCreateSchema), handleCreateKpiStat);
router.put("/:id", authenticate, requireAdmin, validate(kpiStatUpdateSchema), handleUpdateKpiStat);
router.delete("/:id", authenticate, requireAdmin, handleDeleteKpiStat);

export default router;