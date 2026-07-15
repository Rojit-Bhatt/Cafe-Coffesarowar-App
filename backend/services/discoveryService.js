const Organization = require("../models/Organization");
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

      return {
        id: org._id.toString(),
        slug: org.slug,
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
          rewardTitle: org.program.rewardTitle
        },
        createdAt: org.createdAt,
        recentStampCount
      };
    })
  );

  return { success: true, businesses };
};

module.exports = { getDiscoverBusinesses };
