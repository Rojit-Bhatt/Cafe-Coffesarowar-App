const Organization = require("../models/Organization");
const Company = require("../models/Company");
const { resolveProgram } = require("./programService");
const StampClaimEvent = require("../models/StampClaimEvent");

const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Returns every active business with enough data for the customer-facing
// /explore directory, plus a real "recentStampCount" trending signal. Search,
// category filtering, and nearby/trending sorting all happen client-side over
// this one payload — the in-memory mock DB used in dev/tests has no
// aggregation or $regex support, and at this app's current scale a full scan
// with a per-org count loop (mirroring stampService.getCustomerDetailRows) is
// simpler and safe.
const getDiscoverBusinesses = async () => {
  const organizations = await Organization.find({ status: "active" });
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);

  const businesses = await Promise.all(
    organizations.map(async (org) => {
      const recentStampCount = await StampClaimEvent.countDocuments({
        organizationId: org._id,
        createdAt: { $gte: since }
      });

      const company = await Company.findOne({ _id: org.companyId });
      // An outlet slug is only unique within its company, so /explore must
      // carry the company slug too — it's a path component the client needs
      // to build /[company]/[outlet], and the only place a slug crosses the
      // API boundary as one.
      if (!company || company.status !== "active") return null;
      const program = resolveProgram(company, org);

      return {
        id: org._id.toString(),
        slug: org.slug,
        companySlug: company.slug,
        companyName: company.name,
        name: org.name,
        category: org.category,
        branding: {
          bannerUrl: org.branding.bannerUrl,
          logoUrl: org.branding.logoUrl,
          primaryColor: org.branding.primaryColor
        },
        contact: {
          latitude: org.contact.latitude,
          longitude: org.contact.longitude
        },
        program: {
          rewardTitle: program.rewardTitle
        },
        createdAt: org.createdAt,
        recentStampCount
      };
    })
  );

  return { success: true, businesses: businesses.filter(Boolean) };
};

module.exports = { getDiscoverBusinesses };
