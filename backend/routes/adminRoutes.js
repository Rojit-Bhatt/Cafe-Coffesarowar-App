const express = require("express");
const {
  generateAdminQRToken,
  generateAdminRedeemToken,
  getTransactions,
  getCustomersList
} = require("../controllers/pointsController");
const { getMySettings, updateMySettings } = require("../controllers/tenantController");
const {
  listMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuFile,
  previewMenuImport,
  confirmMenuImport,
  downloadMenuTemplate
} = require("../controllers/menuController");
const {
  getDashboard,
  getSummary,
  downloadSummary,
  downloadCustomers,
  downloadTransactions,
} = require("../controllers/reportController");
const { listEvents, createEventController, updateEventController, deleteEventController } = require("../controllers/eventController");
const { verifyToken, isBusinessAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Both sides of the counter are staff-initiated: earn carries the bill,
// redeem carries nothing and lets the customer pick after scanning.
router.post("/generate-qr", verifyToken, isBusinessAdmin, generateAdminQRToken);
router.post("/generate-redeem-qr", verifyToken, isBusinessAdmin, generateAdminRedeemToken);
router.get("/transactions", verifyToken, isBusinessAdmin, getTransactions);
router.get("/customers", verifyToken, isBusinessAdmin, getCustomersList);
router.get("/settings", verifyToken, isBusinessAdmin, getMySettings);
router.patch("/settings", verifyToken, isBusinessAdmin, updateMySettings);
router.get("/menu", verifyToken, isBusinessAdmin, listMenu);
router.post("/menu", verifyToken, isBusinessAdmin, createMenuItem);
router.post("/menu/import/preview", verifyToken, isBusinessAdmin, uploadMenuFile, previewMenuImport);
router.post("/menu/import/confirm", verifyToken, isBusinessAdmin, confirmMenuImport);
router.get("/menu/template", verifyToken, isBusinessAdmin, downloadMenuTemplate);
router.patch("/menu/:id", verifyToken, isBusinessAdmin, updateMenuItem);
router.delete("/menu/:id", verifyToken, isBusinessAdmin, deleteMenuItem);
router.get("/dashboard-stats", verifyToken, isBusinessAdmin, getDashboard);
router.get("/reports/summary", verifyToken, isBusinessAdmin, getSummary);
router.get("/reports/summary/download", verifyToken, isBusinessAdmin, downloadSummary);
router.get("/reports/customers/download", verifyToken, isBusinessAdmin, downloadCustomers);
router.get("/reports/transactions/download", verifyToken, isBusinessAdmin, downloadTransactions);
router.get("/events", verifyToken, isBusinessAdmin, listEvents);
router.post("/events", verifyToken, isBusinessAdmin, createEventController);
router.patch("/events/:id", verifyToken, isBusinessAdmin, updateEventController);
router.delete("/events/:id", verifyToken, isBusinessAdmin, deleteEventController);

module.exports = router;
