import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { validateRequest, stringSchema } from "../middlewares/validation.middleware.js";
import { isValidStoredUrl } from "../validations/storedUrl.schema.js";
import {
  handleGetAllSpontaneousApplications,
  handleGetSpontaneousApplication,
  handleCreateSpontaneousApplication,
  handleUpdateSpontaneousApplication,
  handleDeleteSpontaneousApplication,
} from "../controllers/SpontaneousApplication.controller.js";
import { spontaneousApplicationUpdateSchema } from "../validations/spontaneousapplication.schema.js";

const router = Router();

const createSpontaneousApplicationValidation = validateRequest([
  stringSchema("first_name", { max: 100 }),
  stringSchema("last_name", { max: 100 }),
  body("email").trim().isEmail().withMessage("Email invalide"),
  stringSchema("phone", { optional: true, max: 30 }),
  stringSchema("cv_url", { optional: true, max: 500 })
    .custom(isValidStoredUrl)
    .withMessage("cv_url invalide (chemin /uploads, /images ou URL http(s))"),
  stringSchema("motivation", { optional: true, max: 5000 }),
]);

// Public routes (affichage front - candidature spontanée publique)
router.get("/", handleGetAllSpontaneousApplications);
router.get("/:id", handleGetSpontaneousApplication);

// Public route - submission
router.post("/", createSpontaneousApplicationValidation, handleCreateSpontaneousApplication);

// Admin only routes
router.put("/:id", authenticate, requireAdmin, validate(spontaneousApplicationUpdateSchema), handleUpdateSpontaneousApplication);
router.delete("/:id", authenticate, requireAdmin, handleDeleteSpontaneousApplication);

export default router;
