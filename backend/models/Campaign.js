const mongoose = require("mongoose");

// A time-boxed points multiplier an outlet runs ("2x this weekend").
// Outlet-scoped like every other loyalty record — a company's campaigns are
// not shared across its outlets, same as its points.
//
// Distinct from Event, which is a display-only listing with no effect on
// earning. A Campaign changes what a bill is worth; an Event does not.
const CampaignSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },

  // What a bill earns while this is live. 2 = double points. Stored as a
  // plain float: it is never $inc-ed, only read and multiplied once inside
  // earnCenti, whose Math.round collapses any float error before it can
  // reach a balance.
  multiplier: { type: Number, required: true, min: 1 },

  // The window this runs in. Absolute instants, correct in UTC — no timezone
  // handling needed here. Null endAt = runs until switched off.
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },

  // Optional day filter INSIDE the window, 0=Sunday..6=Saturday, judged in
  // PLATFORM_TIMEZONE (not UTC — see config/platform.js). Empty = every day.
  // A campaign is live only when the window AND the day both match.
  daysOfWeek: { type: [Number], default: [] },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CampaignSchema.index({ organizationId: 1, isActive: 1 });

module.exports = mongoose.model("Campaign", CampaignSchema);
