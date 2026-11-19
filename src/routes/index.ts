import { Router } from "express";
import { body } from "express-validator";
import {
  authenticate,
  requireReauthentication,
  requireSuperAdmin,
  forcePasswordChange,
} from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rateLimit.js";
import { validateRequest } from "../middlewares/validation.middleware.js";
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
  handleRefresh,
  handleLogout,
  handleLogoutAll,
  handleRegenerateRecoveryCodes,
  handleResetAdminAccess,
  handleChangePassword,
  handleDisableMfa,
  handleGetAuditLogs,
  handleForceChangePassword,
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
    .isLength({ min: 12 })
    .withMessage("Le mot de passe doit contenir au moins 12 caractères"),
  body("invitationToken")
    .isString()
    .notEmpty()
    .withMessage("Le token d'invitation est requis"),
]);

const mfaValidation = validateRequest([
  body("mfaToken").isString().notEmpty().withMessage("mfaToken requis"),
  body("code")
    .isString()
    .matches(/^\d{6}$/)
    .withMessage("Code MFA invalide (6 chiffres requis)"),
]);

/** Vérification à la connexion : code de l'application (6 chiffres) OU code de secours. */
const mfaVerifyValidation = validateRequest([
  body("mfaToken").isString().notEmpty().withMessage("mfaToken requis"),
  body("code")
    .if(body("recoveryCode").not().exists())
    .isString()
    .matches(/^\d{6}$/)
    .withMessage("Code MFA invalide (6 chiffres requis)"),
  body("recoveryCode")
    .optional()
    .isString()
    .isLength({ min: 8, max: 20 })
    .withMessage("Code de secours invalide"),
]);

const refreshValidation = validateRequest([
  body("refreshToken")
    .optional()
    .isString()
    .notEmpty()
    .withMessage("refreshToken requis dans le body ou le cookie"),
]);

// Public routes (rate limited)
router.post("/admin/login", authLimiter, loginValidation, handleLogin);
router.post("/admin/set-password", authLimiter, setPasswordValidation, handleSetPassword);

// Auth routes (MFA onboarding + verification)
router.post("/auth/login", authLimiter, loginValidation, handleLogin);
router.post("/auth/mfa/confirm-setup", authLimiter, mfaValidation, handleConfirmMfaSetup);
router.post("/auth/mfa/verify", authLimiter, mfaVerifyValidation, handleVerifyMfa);
router.post("/auth/refresh", authLimiter, refreshValidation, handleRefresh);

// Admin aliases for the MFA endpoints
router.post("/admin/mfa/confirm-setup", authLimiter, mfaValidation, handleConfirmMfaSetup);
router.post("/admin/mfa/verify", authLimiter, mfaVerifyValidation, handleVerifyMfa);

// Authenticated user routes
router.get("/admin/me", authenticate, handleGetProfile);
router.post("/admin/logout", authenticate, handleLogout);
router.post("/auth/logout", authenticate, handleLogout);
router.post("/auth/logout-all", authenticate, handleLogoutAll);

// Sensitive operations — require the current password even with a valid JWT
// Routes qui vérifient un mot de passe : limitées comme la connexion (5 essais / 30 s par IP).
router.post("/auth/change-password", authLimiter, authenticate, requireReauthentication, handleChangePassword);
router.post("/auth/mfa/disable", authLimiter, authenticate, requireReauthentication, handleDisableMfa);
router.post("/auth/mfa/recovery-codes", authLimiter, authenticate, requireReauthentication, handleRegenerateRecoveryCodes);

// Force change password — accessible when force_password_change is active
router.post("/auth/force-change-password", authLimiter, authenticate, handleForceChangePassword);

// SuperAdmin only routes
router.post("/admin/invite", authenticate, requireSuperAdmin, forcePasswordChange, handleInviteAdmin);
router.get("/admin", authenticate, requireSuperAdmin, forcePasswordChange, handleGetAllAdmins);
router.delete("/admin/:id/deactivate", authenticate, requireSuperAdmin, forcePasswordChange, handleDeactivateAdmin);
router.post("/admin/:id/reset-access", authenticate, requireSuperAdmin, forcePasswordChange, handleResetAdminAccess);
router.delete("/admin/:id", authenticate, requireSuperAdmin, forcePasswordChange, handleDeleteAdmin);

// Piste d'audit (consultation réservée superAdmin)
router.get("/admin/audit-logs", authenticate, requireSuperAdmin, forcePasswordChange, handleGetAuditLogs);

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
