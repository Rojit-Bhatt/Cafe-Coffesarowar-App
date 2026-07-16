const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { logAction } = require("./platformAuditService");

const SALT_ROUNDS = 10;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const listAdmins = async () => {
  const admins = await User.find({ role: "platform" });
  return admins.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    email: a.email,
    platformRole: a.platformRole || "owner",
    createdAt: a.createdAt
  }));
};

const inviteAdmin = async ({ name, email, password, platformRole, actorId, actorName }) => {
  if (!name || !email || !password) {
    throw createHttpError("name, email, and password are required.", 400);
  }

  const safeRole = platformRole === "support" ? "support" : "owner";
  const normalizedEmail = normalizeEmail(email);

  const existing = await User.findOne({ organizationId: null, email: normalizedEmail });
  if (existing) {
    throw createHttpError("A platform admin with this email already exists.", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await User.create({
    organizationId: null,
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: "platform",
    platformRole: safeRole,
    emailVerified: true
  });

  await logAction({
    actorId,
    actorName,
    action: "invite_admin",
    organizationId: null,
    targetName: admin.name,
    details: `Invited as ${safeRole} (${admin.email})`
  });

  return { id: admin._id.toString(), name: admin.name, email: admin.email, platformRole: safeRole };
};

const removeAdmin = async ({ id, actorId, actorName }) => {
  if (id === actorId) {
    throw createHttpError("You can't remove your own account.", 400);
  }

  const admin = await User.findOne({ _id: id, role: "platform" });
  if (!admin) {
    throw createHttpError("Platform admin not found.", 404);
  }

  await User.deleteOne({ _id: id });

  await logAction({
    actorId,
    actorName,
    action: "remove_admin",
    organizationId: null,
    targetName: admin.name,
    details: `Removed (${admin.email})`
  });
};

module.exports = { listAdmins, inviteAdmin, removeAdmin };
