const mongoose = require("mongoose");

// A customer's points balance at ONE outlet. Replaces the old StampCard.
// Points never pool across outlets, so this row is meaningless without its
// organizationId — same isolation invariant as every other loyalty record.
const PointsBalanceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // INTEGER centipoints, never a float — see utils/pointsMath.js for why.
  // Mutated only via $inc inside a transaction, guarded on $gte for spends,
  // so it can never go negative through the service layer.
  balanceCenti: { type: Number, min: 0, default: 0 },

  // Last earn or redeem. The rolling-inactivity expiry clock restarts from
  // here, so any activity keeps the whole balance alive. Null = never active,
  // which cannot expire (there is nothing to expire).
  lastActivityAt: { type: Date, default: null },

  // When an expiry was last materialized onto this row. Purely informational
  // — expiry is always DERIVED from lastActivityAt at read time; this just
  // records when the derived state was last written down.
  expiredAt: { type: Date, default: null }
});

// One balance per customer per outlet. The mock DB doesn't enforce unique
// indexes, so pointsService relies on an upsert rather than this promise.
PointsBalanceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PointsBalance", PointsBalanceSchema);
