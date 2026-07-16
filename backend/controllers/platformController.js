const {
  loginPlatformAdmin,
  listBusinesses,
  createBusiness,
  getBusiness,
  updateBusiness
} = require("../services/platformService");
const {
  getContact,
  updateContact
} = require("../services/platformConfigService");
const { listRecent } = require("../services/platformAuditService");
const { getPlatformAnalytics } = require("../services/platformAnalyticsService");
const User = require("../models/User");

const platformLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginPlatformAdmin({ email, password });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getBusinesses = async (req, res, next) => {
  try {
    const result = await listBusinesses();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const postBusiness = async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, category } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const result = await createBusiness({
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword,
      category,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getBusinessById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getBusiness(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const patchBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, status, adminEmail } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const result = await updateBusiness(id, {
      name,
      category,
      status,
      adminEmail,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAuditLog = async (req, res, next) => {
  try {
    const entries = await listRecent(100);
    res.status(200).json({ success: true, entries });
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const stats = await getPlatformAnalytics();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    next(error);
  }
};

const getPublicPlatformContact = async (req, res, next) => {
  try {
    const contact = await getContact();
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};

const getPlatformContactAdmin = async (req, res, next) => {
  try {
    const contact = await getContact();
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};

const patchPlatformContact = async (req, res, next) => {
  try {
    const contact = await updateContact(req.body || {});
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
