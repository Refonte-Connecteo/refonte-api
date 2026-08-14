import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validation.middleware.js";
import { pageViewLimiter } from "../middlewares/rateLimit.js";
import {
  handleRecordPageView,
  handleGetDashboardSummary,
} from "../controllers/analytics.controller.js";

const router = Router();

const pageViewValidation = validateRequest([
  body("path").isString().trim().withMessage("path invalide"),
  body("visitorId")
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage("visitorId invalide"),
  body("referrer")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 500 })
    .withMessage("referrer invalide"),
]);

// Public : remontee de vues du site (rate-limite)
router.post("/page-view", pageViewLimiter, pageViewValidation, handleRecordPageView);

// SuperAdmin uniquement
router.get("/summary", authenticate, requireSuperAdmin, handleGetDashboardSummary);

export default router;
