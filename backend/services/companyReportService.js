const Organization = require("../models/Organization");
const User = require("../models/User");
const PointsTransaction = require("../models/PointsTransaction");
const { toPoints } = require("../utils/pointsMath");

const DAY_MS = 24 * 60 * 60 * 1000;

// Cross-outlet rollup for the company console. Deliberately company-private:
// this is only ever reachable through /api/company (verifyCompanySession),
// never through /api/admin — an outlet's own console must never be able to
// see its siblings' numbers. Same reasoning as the per-tenant reporting
// isolation the customer identity already preserves.
//
// Summed in JS per outlet rather than aggregated, because the mock DB has no
// aggregation pipeline — the same approach reportService.getDashboardStats
// already takes.
//
// Note this rolls up FLOWS (points issued/redeemed, revenue) and never
// balances: points are per-outlet and never pool, so a company-wide "points
// balance" would be adding up numbers that can't be spent together.
const getCompanyRollup = async (companyId) => {
  const outlets = await Organization.find({ companyId });
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS);

  const perOutlet = await Promise.all(
    outlets.map(async (outlet) => {
      const customers = await User.find({ organizationId: outlet._id, role: "customer" });
      const txns = await PointsTransaction.find({ organizationId: outlet._id });

      const earns = txns.filter((t) => t.type === "earn");
      const redeems = txns.filter((t) => t.type === "redeem");
      const recentEarns = earns.filter((t) => new Date(t.createdAt) >= weekAgo);

      const revenue = earns.reduce((sum, t) => sum + (t.billAmount || 0), 0);

      return {
        outletId: outlet._id.toString(),
        slug: outlet.slug,
        name: outlet.name,
        status: outlet.status,
        customersCount: customers.length,
        transactions: earns.length + redeems.length,
        pointsIssuedCenti: earns.reduce((sum, t) => sum + t.pointsCenti, 0),
        pointsIssuedThisWeekCenti: recentEarns.reduce((sum, t) => sum + t.pointsCenti, 0),
        pointsRedeemedCenti: redeems.reduce((sum, t) => sum - t.pointsCenti, 0),
        redemptionCount: redeems.length,
        revenue
      };
    })
  );

  const totals = perOutlet.reduce(
    (acc, o) => ({
      customersCount: acc.customersCount + o.customersCount,
      transactions: acc.transactions + o.transactions,
      pointsIssuedCenti: acc.pointsIssuedCenti + o.pointsIssuedCenti,
      pointsIssuedThisWeekCenti: acc.pointsIssuedThisWeekCenti + o.pointsIssuedThisWeekCenti,
      pointsRedeemedCenti: acc.pointsRedeemedCenti + o.pointsRedeemedCenti,
      redemptionCount: acc.redemptionCount + o.redemptionCount,
      revenue: acc.revenue + o.revenue
    }),
    {
      customersCount: 0, transactions: 0, pointsIssuedCenti: 0,
      pointsIssuedThisWeekCenti: 0, pointsRedeemedCenti: 0, redemptionCount: 0, revenue: 0
    }
  );

  // Centipoints never leave the backend — convert once, here, on the way out.
  const present = (row) => ({
    ...row,
    pointsIssued: toPoints(row.pointsIssuedCenti),
    pointsIssuedThisWeek: toPoints(row.pointsIssuedThisWeekCenti),
    pointsRedeemed: toPoints(row.pointsRedeemedCenti),
    revenue: Math.round(row.revenue * 100) / 100,
    pointsIssuedCenti: undefined,
    pointsIssuedThisWeekCenti: undefined,
    pointsRedeemedCenti: undefined
  });

  return {
    success: true,
    totals: {
      ...present(totals),
      outletCount: perOutlet.filter((o) => o.status !== "archived").length
    },
    outlets: perOutlet.map(present).sort((a, b) => b.revenue - a.revenue)
  };
};

module.exports = { getCompanyRollup };
