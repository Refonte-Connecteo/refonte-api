import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import {
  handleInviteAdmin,
  handleSetPassword,
  handleLogin,
  handleGetAllAdmins,
  handleDeactivateAdmin,
  handleGetProfile,
} from "../controllers/user.controller.js";

const router = Router();

// Public routes
router.post("/admin/login", handleLogin);
router.post("/admin/set-password", handleSetPassword);

// SuperAdmin only routes
router.post("/admin/invite", authenticate, requireSuperAdmin, handleInviteAdmin);
router.get("/admin", authenticate, requireSuperAdmin, handleGetAllAdmins);
router.delete("/admin/:id", authenticate, requireSuperAdmin, handleDeactivateAdmin);

// Authenticated user routes
router.get("/admin/me", authenticate, handleGetProfile);

export default router;
