import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rateLimit.js";
import {
  handleInviteAdmin,
  handleSetPassword,
  handleLogin,
  handleGetAllAdmins,
  handleDeactivateAdmin,
  handleDeleteAdmin,
  handleGetProfile,
  handleCheckPending,
  handleLogout,
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

// Public routes (rate limited)
router.post("/admin/login", authLimiter, handleLogin);
router.post("/admin/set-password", authLimiter, handleSetPassword);
router.post("/admin/check-pending", authLimiter, handleCheckPending);

// SuperAdmin only routes
router.post("/admin/invite", authenticate, requireSuperAdmin, handleInviteAdmin);
router.get("/admin", authenticate, requireSuperAdmin, handleGetAllAdmins);
router.delete("/admin/:id/deactivate", authenticate, requireSuperAdmin, handleDeactivateAdmin);
router.delete("/admin/:id", authenticate, requireSuperAdmin, handleDeleteAdmin);

// Authenticated user routes
router.get("/admin/me", authenticate, handleGetProfile);
router.post("/admin/logout", authenticate, handleLogout);

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
