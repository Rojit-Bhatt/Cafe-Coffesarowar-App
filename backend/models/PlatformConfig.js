const mongoose = require("mongoose");

// Singleton config for the platform itself (the SaaS, not a tenant) — there
// is exactly one document, always looked up by the fixed `singleton: true`
// key via findOneAndUpdate(..., { upsert: true }). Distinct from a tenant's
// own Organization.contact (D3): this is the platform's own contact info,
// shown on the public platform landing page, not any business's.
const PlatformConfigSchema = new mongoose.Schema({
  singleton: { type: Boolean, default: true, unique: true },

  contact: {
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    hours: { type: String, default: "" },
    aboutUs: { type: String, default: "" },
    socials: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      x: { type: String, default: "" }
    }
  }
});

module.exports = mongoose.model("PlatformConfig", PlatformConfigSchema);
