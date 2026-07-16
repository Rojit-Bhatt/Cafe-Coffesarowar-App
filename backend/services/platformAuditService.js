const PlatformAuditLog = require("../models/PlatformAuditLog");

const logAction = async ({ actorId, actorName, action, organizationId, targetName, details }) => {
  // Derived from the persisted document count rather than an in-memory
  // counter, so ordering stays correct across process restarts too.
  const sequence = await PlatformAuditLog.countDocuments({});
  await PlatformAuditLog.create({
    actorId,
    actorName,
    action,
    organizationId: organizationId || null,
    targetName,
    details: details || "",
    sequence
  });
};

const listRecent = async (limit = 100) => {
  const entries = await PlatformAuditLog.find({});
  // Sorted here in plain JS rather than via the ORM's .sort() — the mock
  // DB's sort only honors a single key, so it can't be given sequence as
  // a tiebreaker.
  const sorted = [...entries].sort((a, b) => b.sequence - a.sequence);
  return sorted.slice(0, limit).map((e) => ({
    id: e._id.toString(),
    actorName: e.actorName,
    action: e.action,
    targetName: e.targetName,
    details: e.details,
    createdAt: e.createdAt
  }));
};

module.exports = { logAction, listRecent };
