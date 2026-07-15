const express = require("express");
const {
  register, login, googleAuth,
  verifyEmail, resendVerification, forgotPassword, resetPassword,
  completeProfile, enterTenant, getMyTenants
} = require("../controllers/customerAccountController");
const { resolveTenant } = require("../middleware/tenantMiddleware");
const { verifyGlobalSession } = require("../middleware/customerAuthMiddleware");
const { discover } = require("../controllers/discoveryController");

const router = express.Router();

// Global — no tenant context at all.
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/complete-profile", verifyGlobalSession, completeProfile);

// Needs a resolved tenant (which org to provision into) + a valid global
// session (which account) — the exchange for a tenant JWT.
router.post("/enter-tenant", resolveTenant, verifyGlobalSession, enterTenant);

// Cross-tenant customer surface (/explore) — global session only, no tenant.
router.get("/discover", verifyGlobalSession, discover);
router.get("/my-tenants", verifyGlobalSession, getMyTenants);

module.exports = router;
