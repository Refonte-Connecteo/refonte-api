import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import {
  handleInviteAdmin,
  handleSetPassword,
  handleLogin,
  handleGetAllAdmins,
  handleDeactivateAdmin,
  handleDeleteAdmin,
  handleGetProfile,
  handleCheckPending,
} from "../controllers/user.controller.js";

const router = Router();

// Public routes
router.post("/admin/login", handleLogin);
router.post("/admin/set-password", handleSetPassword);
router.post("/admin/check-pending", handleCheckPending);

// SuperAdmin only routes
router.post("/admin/invite", authenticate, requireSuperAdmin, handleInviteAdmin);
router.get("/admin", authenticate, requireSuperAdmin, handleGetAllAdmins);
router.delete("/admin/:id/deactivate", authenticate, requireSuperAdmin, handleDeactivateAdmin);
router.delete("/admin/:id", authenticate, requireSuperAdmin, handleDeleteAdmin);

// Authenticated user routes
router.get("/admin/me", authenticate, handleGetProfile);

export default router;
