import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { validateRequest, stringSchema, rejectUnknownBodyFields } from "../middlewares/validation.middleware.js";
import { isValidStoredUrl } from "../validations/storedUrl.schema.js";
import {
  handleGetAllApplications,
  handleGetApplication,
  handleGetApplicationsByJobId,
  handleCreateApplication,
  handleUpdateApplication,
  handleDeleteApplication,
} from "../controllers/Application.controller.js";
import { applicationUpdateSchema } from "../validations/application.schema.js";

const router = Router();

const createApplicationValidation = validateRequest([
  body("job_id").isInt({ min: 1 }).withMessage("job_id invalide"),
  stringSchema("first_name", { max: 100 }),
  stringSchema("last_name", { max: 100 }),
  body("email").trim().isEmail().withMessage("Email invalide"),
  stringSchema("phone", { optional: true, max: 30 }),
  stringSchema("cv_url", { optional: true, max: 500 })
    .custom(isValidStoredUrl)
    .withMessage("cv_url invalide (chemin /uploads, /images ou URL http(s))"),
  stringSchema("cover_letter", { optional: true, max: 5000 }),
]);

// Minimisation RGPD : seuls les champs strictement nécessaires sont acceptés.
const APPLICATION_ALLOWED_FIELDS = [
  "job_id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "cv_url",
  "cover_letter",
] as const;

// Public routes (affichage front - candidature publique)
router.get("/", handleGetAllApplications);
router.get("/job/:jobId", handleGetApplicationsByJobId);
router.get("/:id", handleGetApplication);
router.post(
  "/",
  rejectUnknownBodyFields(APPLICATION_ALLOWED_FIELDS),
  createApplicationValidation,
  handleCreateApplication,
);

// Admin only routes
router.put("/:id", authenticate, requireAdmin, validate(applicationUpdateSchema), handleUpdateApplication);
router.delete("/:id", authenticate, requireAdmin, handleDeleteApplication);

export default router;
