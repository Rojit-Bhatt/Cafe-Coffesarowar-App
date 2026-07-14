const mongoose = require("mongoose");

const DynamicQRTokenSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  token: { type: String, required: true, unique: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isUsed: { type: Boolean, default: false },
  // Bill amount entered by the barista at generation time, if any. Carried
  // through to the StampClaimEvent when a customer consumes this token —
  // see stampService.claimStamp. Null when the min-bill gate is disabled
  // and nothing was entered.
  billAmount: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

DynamicQRTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 });

module.exports = mongoose.model("DynamicQRToken", DynamicQRTokenSchema);
