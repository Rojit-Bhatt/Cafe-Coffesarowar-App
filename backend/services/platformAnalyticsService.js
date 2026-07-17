const Organization = require("../models/Organization");
const User = require("../models/User");
const PointsTransaction = require("../models/PointsTransaction");
const { toPoints } = require("../utils/pointsMath");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

const weekOverWeekTrend = (current, previous) => {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? null : 0;
};

// Platform-wide rollup: every query here is deliberately missing an
// organizationId filter — this is the one surface where cross-tenant
// aggregation is the point (a platform admin overseeing the whole SaaS),
// not a leak. It never exposes which specific tenant a customer belongs
// to, only aggregate counts/sums, so it doesn't violate the per-tenant
// isolation invariant that governs every other report in this codebase.
const getPlatformAnalytics = async () => {
  const now = new Date();
  const currentStart = new Date(now.getTime() - WEEK_MS);
  const previousStart = new Date(now.getTime() - 2 * WEEK_MS);
  const currentRange = { $gte: currentStart, $lte: now };
  const previousRange = { $gte: previousStart, $lte: currentStart };

  const [
    businessesTotal,
    businessesActiveOrgs,
    newCustomersCurrent,
    newCustomersPrevious,
    txnsCurrent,
    txnsPrevious
  ] = await Promise.all([
    Organization.countDocuments({}),
    Organization.find({ status: "active" }),
    User.countDocuments({ role: "customer", createdAt: currentRange }),
    User.countDocuments({ role: "customer", createdAt: previousRange }),
    PointsTransaction.find({ createdAt: currentRange }),
    PointsTransaction.find({ createdAt: previousRange })
  ]);

  const earnsCurrent = txnsCurrent.filter((t) => t.type === "earn");
  const earnsPrevious = txnsPrevious.filter((t) => t.type === "earn");
  const redeemsCurrent = txnsCurrent.filter((t) => t.type === "redeem");
  const redeemsPrevious = txnsPrevious.filter((t) => t.type === "redeem");

  const pointsCurrent = earnsCurrent.reduce((sum, t) => sum + t.pointsCenti, 0);
  const pointsPrevious = earnsPrevious.reduce((sum, t) => sum + t.pointsCenti, 0);
  const revenueCurrent = earnsCurrent.reduce((sum, t) => sum + (t.billAmount || 0), 0);
  const revenuePrevious = earnsPrevious.reduce((sum, t) => sum + (t.billAmount || 0), 0);

  const velocityStart = new Date(now.getTime() - 14 * DAY_MS);
  const velocityTxns = await PointsTransaction.find({ createdAt: { $gte: velocityStart, $lte: now } });
  const velocityByDay = new Map();
  for (let i = 13; i >= 0; i -= 1) {
    velocityByDay.set(dayKey(new Date(now.getTime() - i * DAY_MS)), 0);
  }
  for (const txn of velocityTxns) {
    if (txn.type !== "earn") continue;
    const key = dayKey(txn.createdAt);
    if (velocityByDay.has(key)) velocityByDay.set(key, velocityByDay.get(key) + txn.pointsCenti);
  }
  const pointsVelocity = Array.from(velocityByDay.entries()).map(([date, centi]) => ({
    date,
    points: toPoints(centi)
  }));

  return {
    businessesTotal,
    businessesActive: businessesActiveOrgs.length,
    newCustomers: { value: newCustomersCurrent, trend: weekOverWeekTrend(newCustomersCurrent, newCustomersPrevious) },
    pointsIssued: { value: toPoints(pointsCurrent), trend: weekOverWeekTrend(pointsCurrent, pointsPrevious) },
    revenue: { value: Math.round(revenueCurrent * 100) / 100, trend: weekOverWeekTrend(revenueCurrent, revenuePrevious) },
    redemptions: { value: redeemsCurrent.length, trend: weekOverWeekTrend(redeemsCurrent.length, redeemsPrevious.length) },
    pointsVelocity
  };
};

module.exports = { getPlatformAnalytics };
