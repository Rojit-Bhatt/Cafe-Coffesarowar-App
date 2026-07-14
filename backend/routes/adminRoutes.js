const express = require("express");
const {
  generateAdminQRToken,
  getRecentScans,
  getCustomersList
} = require("../controllers/stampController");
const { redeemAdminVoucher } = require("../controllers/voucherController");
const { getMySettings, updateMySettings } = require("../controllers/tenantController");
const {
  listMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuFile,
  importMenuItemsController,
  downloadMenuTemplate
} = require("../controllers/menuController");
const { getSummary, downloadSummary, downloadCustomers } = require("../controllers/reportController");
const { listEvents, createEventController, updateEventController, deleteEventController } = require("../controllers/eventController");
const { verifyToken, isBusinessAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/generate-qr", verifyToken, isBusinessAdmin, generateAdminQRToken);
router.post("/redeem-voucher", verifyToken, isBusinessAdmin, redeemAdminVoucher);
router.get("/recent-scans", verifyToken, isBusinessAdmin, getRecentScans);
router.get("/customers", verifyToken, isBusinessAdmin, getCustomersList);
router.get("/settings", verifyToken, isBusinessAdmin, getMySettings);
router.patch("/settings", verifyToken, isBusinessAdmin, updateMySettings);
router.get("/menu", verifyToken, isBusinessAdmin, listMenu);
router.post("/menu", verifyToken, isBusinessAdmin, createMenuItem);
router.post("/menu/import", verifyToken, isBusinessAdmin, uploadMenuFile, importMenuItemsController);
router.get("/menu/template", verifyToken, isBusinessAdmin, downloadMenuTemplate);
router.patch("/menu/:id", verifyToken, isBusinessAdmin, updateMenuItem);
router.delete("/menu/:id", verifyToken, isBusinessAdmin, deleteMenuItem);
router.get("/reports/summary", verifyToken, isBusinessAdmin, getSummary);
router.get("/reports/summary/download", verifyToken, isBusinessAdmin, downloadSummary);
router.get("/reports/customers/download", verifyToken, isBusinessAdmin, downloadCustomers);
router.get("/events", verifyToken, isBusinessAdmin, listEvents);
router.post("/events", verifyToken, isBusinessAdmin, createEventController);
router.patch("/events/:id", verifyToken, isBusinessAdmin, updateEventController);
router.delete("/events/:id", verifyToken, isBusinessAdmin, deleteEventController);

module.exports = router;
