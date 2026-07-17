const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const CustomerAccount = require("../models/CustomerAccount");
const AccountVerificationToken = require("../models/AccountVerificationToken");
const AdminAccount = require("../models/AdminAccount");
const AdminVerificationToken = require("../models/AdminVerificationToken");
const PointsBalance = require("../models/PointsBalance");
const Subscription = require("../models/Subscription");
const { resolveTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// DEV/TEST ONLY. Mints a raw verification/reset token for an email so
// self-contained tests can drive the email-verify / password-reset flow
// without reading email. Mounted only when MONGODB_URI is unset (mock DB),
// never in production (see server.js guard).
router.post("/mint-token", resolveTenant, async (req, res, next) => {
  try {
    const { email, type } = req.body;
    const user = await User.findOne({
      organizationId: req.organizationId,
      email: String(email || "").toLowerCase()
    });
    if (!user) return res.status(404).json({ success: false });

    const raw = crypto.randomBytes(32).toString("hex");
    await VerificationToken.create({
      organizationId: req.organizationId,
      userId: user._id,
      type,
      tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: null
    });
    res.json({ success: true, token: raw });
  } catch (error) {
    next(error);
  }
});

// DEV/TEST ONLY. Same idea as /mint-token but for the global CustomerAccount
// identity — no tenant needed at all.
router.post("/mint-global-token", async (req, res, next) => {
  try {
    const { email, type } = req.body;
    const account = await CustomerAccount.findOne({ email: String(email || "").toLowerCase() });
    if (!account) return res.status(404).json({ success: false });

    const raw = crypto.randomBytes(32).toString("hex");
    await AccountVerificationToken.create({
      customerAccountId: account._id,
      type,
      tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: null
    });
    res.json({ success: true, token: raw });
  } catch (error) {
    next(error);
  }
});

// DEV/TEST ONLY. Same idea as /mint-global-token but for a staff
// AdminAccount (company owner or outlet admin).
router.post("/mint-admin-token", async (req, res, next) => {
  try {
    const { email, type } = req.body;
    const account = await AdminAccount.findOne({ email: String(email || "").toLowerCase() });
    if (!account) return res.status(404).json({ success: false });

    const raw = crypto.randomBytes(32).toString("hex");
    await AdminVerificationToken.create({
      adminAccountId: account._id,
      type,
      tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: null
    });
    res.json({ success: true, token: raw });
  } catch (error) {
    next(error);
  }
});

// DEV/TEST ONLY. Age a points balance by `daysAgo` so a test can exercise
// expiry without waiting real days or faking the system clock.
//
// Moves BOTH the last activity and the stored deadline back by the same
// amount — which is exactly what the passage of time would have done. The
// deadline is what `isExpiredNow` actually reads, so a hook that only moved
// lastActivityAt would age a field the code no longer consults and prove
// nothing. Nothing on the production path is stubbed: the row ends up in the
// state a genuinely idle customer's row would be in.
router.post("/expire-points", async (req, res, next) => {
  try {
    const { email, organizationId, daysAgo } = req.body;
    // Explicitly not `Number(daysAgo) || 400`: daysAgo: 0 means "reset the
    // clock to now", and `||` would silently turn that into 400 days ago —
    // the exact opposite.
    const days = Number.isFinite(Number(daysAgo)) ? Number(daysAgo) : 400;
    const offsetMs = days * 24 * 60 * 60 * 1000;

    const user = await User.findOne({
      organizationId,
      email: String(email || "").toLowerCase(),
      role: "customer"
    });
    if (!user) return res.status(404).json({ success: false });

    const existing = await PointsBalance.findOne({ organizationId, userId: user._id });
    if (!existing) return res.status(404).json({ success: false });

    const shift = (d) => (d ? new Date(new Date(d).getTime() - offsetMs) : d);

    const balance = await PointsBalance.findOneAndUpdate(
      { organizationId, userId: user._id },
      {
        $set: {
          lastActivityAt: new Date(Date.now() - offsetMs),
          expiresAt: shift(existing.expiresAt)
        }
      },
      { new: true }
    );

    if (!balance) return res.status(404).json({ success: false });

    res.json({ success: true, expiresAt: balance.expiresAt });
  } catch (error) {
    next(error);
  }
});

// DEV/TEST ONLY. Force a subscription's currentPeriodEnd into the past (by
// `daysAgo`, default putting it just past the grace window) so a test can
// deterministically exercise expiry/grace without waiting real days.
// Mirrors /expire-points exactly.
router.post("/expire-subscription", async (req, res, next) => {
  try {
    const { companyId, daysAgo } = req.body;
    const offsetMs = (Number(daysAgo) || 10) * 24 * 60 * 60 * 1000;

    const subscription = await Subscription.findOneAndUpdate(
      { companyId },
      { $set: { currentPeriodEnd: new Date(Date.now() - offsetMs) } },
      { new: true }
    );

    if (!subscription) return res.status(404).json({ success: false });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
