const express = require("express");
const {
  platformLogin,
  getBusinesses,
  postBusiness,
  getBusinessById,
  patchBusiness,
  getAuditLog,
  getAnalytics,
  getPublicPlatformContact,
  getPlatformContactAdmin,
  patchPlatformContact
} = require("../controllers/platformController");
const { getAdmins, postAdmin, deleteAdmin } = require("../controllers/platformTeamController");
const { verifyToken, isPlatformAdmin, isPlatformOwner } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", platformLogin);
router.get("/businesses", verifyToken, isPlatformAdmin, getBusinesses);
router.post("/businesses", verifyToken, isPlatformOwner, postBusiness);
router.get("/businesses/:id", verifyToken, isPlatformAdmin, getBusinessById);
router.patch("/businesses/:id", verifyToken, isPlatformOwner, patchBusiness);
router.get("/audit-log", verifyToken, isPlatformAdmin, getAuditLog);
router.get("/analytics", verifyToken, isPlatformAdmin, getAnalytics);
router.get("/admins", verifyToken, isPlatformOwner, getAdmins);
router.post("/admins", verifyToken, isPlatformOwner, postAdmin);
router.delete("/admins/:id", verifyToken, isPlatformOwner, deleteAdmin);
router.get("/public-contact", getPublicPlatformContact);
router.get("/contact", verifyToken, isPlatformAdmin, getPlatformContactAdmin);
router.patch("/contact", verifyToken, isPlatformOwner, patchPlatformContact);

module.exports = router;
