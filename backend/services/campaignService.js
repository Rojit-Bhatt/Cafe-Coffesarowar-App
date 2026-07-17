const Campaign = require("../models/Campaign");
const { PLATFORM_TIMEZONE, CAMPAIGN_STACKING } = require("../config/platform");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Which weekday an instant falls on IN THE PLATFORM'S TIMEZONE, 0=Sunday.
//
// Not `date.getDay()`: that reads the server's zone (UTC in production), and
// Nepal is UTC+5:45. A "Thursday" campaign judged in UTC would actually run
// Wednesday 18:15 → Thursday 18:15 local — visibly wrong to the business that
// set it. Intl is used rather than a fixed +5:45 offset so the rule survives
// PLATFORM_TIMEZONE being pointed anywhere else.
const localDayOfWeek = (date, timeZone = PLATFORM_TIMEZONE) => {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date);
  return DAY_NAMES.indexOf(name);
};

// Is this campaign live at `now`? Window AND day must both match — a
// weekend-only campaign inside its date range is not live on a Tuesday.
const isLive = (campaign, now = new Date()) => {
  if (!campaign || !campaign.isActive) return false;

  const at = now.getTime();
  if (at < new Date(campaign.startAt).getTime()) return false;
  // Null endAt = open-ended, runs until switched off.
  if (campaign.endAt && at > new Date(campaign.endAt).getTime()) return false;

  const days = campaign.daysOfWeek || [];
  if (days.length === 0) return true;
  return days.includes(localDayOfWeek(now));
};

// The multiplier applying to an earn right now, and which campaign produced
// it. Returns { multiplier: 1, campaign: null } when nothing is live — 1 is
// the identity, so callers never branch.
//
// STACKING RULE: max, never compound (config/platform.js CAMPAIGN_STACKING).
// If a 2x weekend and a 3x holiday both match, the answer is 3x. Compounding
// would make it 6x — more than either campaign promised, and the kind of
// mistake that only shows up on the bill at the end of the month. A business
// that wants 6x writes 6.
const resolveActiveMultiplier = async (organizationId, now = new Date()) => {
  // No nested-path or array queries on the mock DB, and daysOfWeek can't be
  // filtered server-side anyway — fetch this outlet's active campaigns and
  // decide in JS. The set is small by construction (one outlet's campaigns).
  const candidates = await Campaign.find({ organizationId, isActive: true });
  const live = candidates.filter((c) => isLive(c, now));

  if (live.length === 0) return { multiplier: 1, campaign: null };

  const best = live.reduce((a, b) => (b.multiplier > a.multiplier ? b : a));
  if (CAMPAIGN_STACKING !== "max") {
    // Guard rather than silently doing something else: the only other rule
    // anyone would mean is compounding, and that must be a deliberate edit
    // here, not a typo in config.
    throw new Error(`Unsupported CAMPAIGN_STACKING "${CAMPAIGN_STACKING}" — only "max" is implemented.`);
  }

  return { multiplier: best.multiplier, campaign: best };
};

const formatCampaign = (c, now = new Date()) => ({
  id: c._id.toString(),
  name: c.name,
  description: c.description || "",
  multiplier: c.multiplier,
  startAt: c.startAt,
  endAt: c.endAt,
  daysOfWeek: c.daysOfWeek || [],
  isActive: c.isActive,
  // Derived, never stored: "active" is the admin's switch, "live" is whether
  // it is actually multiplying anything this second.
  isLive: isLive(c, now)
});

const listCampaigns = async (organizationId) => {
  const rows = await Campaign.find({ organizationId }).sort({ startAt: -1 });
  const now = new Date();
  return rows.map((c) => formatCampaign(c, now));
};

// What the customer should see: live now, plus what's coming. Never the
// switched-off ones.
const listPublicCampaigns = async (organizationId, now = new Date()) => {
  const rows = await Campaign.find({ organizationId, isActive: true });
  return rows
    .filter((c) => {
      if (c.endAt && new Date(c.endAt).getTime() < now.getTime()) return false;
      return true;
    })
    .map((c) => formatCampaign(c, now))
    .sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
};

const parseCampaignInput = (body) => {
  const name = String(body.name || "").trim();
  if (!name) throw createHttpError("Give the campaign a name.", 400);

  const multiplier = Number(body.multiplier);
  if (!Number.isFinite(multiplier) || multiplier < 1) {
    throw createHttpError("A multiplier has to be at least 1 — anything less would take points away.", 400);
  }

  const startAt = body.startAt ? new Date(body.startAt) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    throw createHttpError("When does this campaign start?", 400);
  }

  let endAt = null;
  if (body.endAt) {
    endAt = new Date(body.endAt);
    if (Number.isNaN(endAt.getTime())) throw createHttpError("That end date doesn't look right.", 400);
    if (endAt.getTime() <= startAt.getTime()) {
      throw createHttpError("The campaign has to end after it starts.", 400);
    }
  }

  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? [...new Set(body.daysOfWeek.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];

  return {
    name,
    description: String(body.description || "").trim(),
    multiplier,
    startAt,
    endAt,
    daysOfWeek,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive)
  };
};

const createCampaign = async (organizationId, body) => {
  const input = parseCampaignInput(body);
  const created = await Campaign.create({ organizationId, ...input });
  return formatCampaign(created);
};

const updateCampaign = async (organizationId, id, body) => {
  // Scoped by organizationId, so an id lifted from another outlet simply
  // doesn't exist here.
  const campaign = await Campaign.findOne({ _id: id, organizationId });
  if (!campaign) throw createHttpError("Campaign not found.", 404);

  // A bare isActive toggle shouldn't have to re-send the whole campaign.
  if (Object.keys(body).length === 1 && body.isActive !== undefined) {
    campaign.isActive = Boolean(body.isActive);
    await campaign.save();
    return formatCampaign(campaign);
  }

  const input = parseCampaignInput({ ...formatCampaign(campaign), ...body });
  Object.assign(campaign, input);
  await campaign.save();
  return formatCampaign(campaign);
};

const deleteCampaign = async (organizationId, id) => {
  const campaign = await Campaign.findOne({ _id: id, organizationId });
  if (!campaign) throw createHttpError("Campaign not found.", 404);
  await Campaign.deleteOne({ _id: campaign._id });
  return { success: true };
};

module.exports = {
  resolveActiveMultiplier,
  listCampaigns,
  listPublicCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  // Exported for tests + reuse: pure, no DB.
  isLive,
  localDayOfWeek,
  formatCampaign,
  DAY_NAMES
};
