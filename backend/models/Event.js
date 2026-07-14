const mongoose = require("mongoose");

// A tenant's upcoming/past event listing. Display-only, same tenant-scoped
// pattern as MenuItem — no RSVP/ticketing, just a display for customers.
const EventSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  // Display string only (e.g. "7:00 PM") — no timezone logic.
  time: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true },
  imageUrl: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: Date.now }
});

EventSchema.index({ organizationId: 1, date: 1 });

module.exports = mongoose.model("Event", EventSchema);
