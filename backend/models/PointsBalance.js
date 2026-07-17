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

  // Last earn or redeem. The rolling-inactivity clock restarts from here, so
  // any activity keeps the whole balance alive.
  lastActivityAt: { type: Date, default: null },

  // When THIS balance dies if untouched — snapshotted at every write from the
  // program in force at that moment. Null = never expires.
  //
  // Stored rather than re-derived from the live program on each read, because
  // a derived window is not a promise: an admin who later tightened
  // pointsExpiryDays would silently vaporize every idle balance (no ledger
  // row, no notice), and one who loosened it would resurrect points customers
  // had already been told were gone — and let them spend them. Snapshotting
  // means a change of policy governs future visits only, which is the deal
  // the customer was actually offered.
  //
  // A row with no expiresAt never expires. That's the safe default: it errs
  // toward keeping points rather than destroying them.
  expiresAt: { type: Date, default: null },

  // When an expiry was materialized onto this row (zeroed + logged).
  // Informational; `expiresAt` is what decides.
  expiredAt: { type: Date, default: null }
});

// One balance per customer per outlet. The mock DB doesn't enforce unique
// indexes, so pointsService relies on an upsert rather than this promise.
PointsBalanceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PointsBalance", PointsBalanceSchema);
