import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../middlewares/validation.middleware.js";
import {
  authenticate,
  requireReauthentication,
  requireSuperAdmin,
} from "../middlewares/auth.middleware.js";
import {
  handleInviteAdmin,
  handleSetPassword,
  handleLogin,
  handleConfirmMfaSetup,
  handleVerifyMfa,
  handleGetAllAdmins,
  handleDeactivateAdmin,
  handleDeleteAdmin,
  handleGetProfile,
  handleCheckPending,
  handleRefresh,
  handleLogout,
  handleChangePassword,
  handleDisableMfa,
} from "../controllers/user.controller.js";
import ceoMessageRouter from "./Ceomessage.routes.js";
import heroSlideRouter from "./HeroSlide.routes.js";
import kpiStatRouter from "./Kpistat.routes.js";
import referenceRouter from "./Reference.routes.js";
import catalogueRouter from "./Catalogue.routes.js";
import jobPostingRouter from "./JobPosting.routes.js";
import applicationRouter from "./Application.routes.js";
import spontaneousApplicationRouter from "./SpontaneousApplication.routes.js";
import articleRouter from "./Article.routes.js";
import eventRouter from "./Event.routes.js";
import eventImageRouter from "./EventImage.routes.js";
import contactMessageRouter from "./ContactMessage.routes.js";

const router = Router();

const loginValidation = validateRequest([
  body("email").trim().isEmail().withMessage("Email invalide"),
  body("password").isString().isLength({ min: 1 }).withMessage("Mot de passe requis"),
]);

const setPasswordValidation = validateRequest([
  body("email").trim().isEmail().withMessage("Email invalide"),
  body("password")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Le mot de passe doit contenir au moins 8 caractères"),
]);

const checkPendingValidation = validateRequest([
  body("email").trim().isEmail().withMessage("Email invalide"),
]);

const mfaValidation = validateRequest([
  body("mfaToken").isString().notEmpty().withMessage("mfaToken requis"),
  body("code")
    .isString()
    .matches(/^\d{6}$/)
    .withMessage("Code MFA invalide (6 chiffres requis)"),
]);

const refreshValidation = validateRequest([
  body("refreshToken")
    .optional()
    .isString()
    .notEmpty()
    .withMessage("refreshToken requis dans le body ou le cookie"),
]);

// Public routes
router.post("/admin/login", loginValidation, handleLogin);
router.post("/admin/set-password", setPasswordValidation, handleSetPassword);
router.post("/admin/check-pending", checkPendingValidation, handleCheckPending);

// Auth routes (MFA onboarding + verification)
router.post("/auth/login", loginValidation, handleLogin);
router.post("/auth/mfa/confirm-setup", mfaValidation, handleConfirmMfaSetup);
router.post("/auth/mfa/verify", mfaValidation, handleVerifyMfa);
router.post("/auth/refresh", refreshValidation, handleRefresh);

// Admin aliases for the MFA endpoints
router.post("/admin/mfa/confirm-setup", handleConfirmMfaSetup);
router.post("/admin/mfa/verify", handleVerifyMfa);

// Authenticated user routes
router.get("/admin/me", authenticate, handleGetProfile);
router.post("/auth/logout", authenticate, handleLogout);

// Sensitive operations — require the current password even with a valid JWT
router.post("/auth/change-password", authenticate, requireReauthentication, handleChangePassword);
router.post("/auth/mfa/disable", authenticate, requireReauthentication, handleDisableMfa);

// SuperAdmin only routes
router.post("/admin/invite", authenticate, requireSuperAdmin, handleInviteAdmin);
router.get("/admin", authenticate, requireSuperAdmin, handleGetAllAdmins);
router.delete("/admin/:id/deactivate", authenticate, requireSuperAdmin, handleDeactivateAdmin);
router.delete("/admin/:id", authenticate, requireSuperAdmin, handleDeleteAdmin);

// Content management routes
router.use("/ceomessage", ceoMessageRouter);
router.use("/hero-slide", heroSlideRouter);
router.use("/kpistat", kpiStatRouter);
router.use("/reference", referenceRouter);
router.use("/catalogue", catalogueRouter);
router.use("/job-posting", jobPostingRouter);
router.use("/application", applicationRouter);
router.use("/spontaneous-application", spontaneousApplicationRouter);
router.use("/article", articleRouter);
router.use("/event", eventRouter);
router.use("/event-image", eventImageRouter);
router.use("/contact-message", contactMessageRouter);

export default router;
