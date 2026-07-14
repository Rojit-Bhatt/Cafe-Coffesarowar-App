const Event = require("../models/Event");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const listForOrg = async (organizationId) => {
  return Event.find({ organizationId }).sort({ date: 1 });
};

const createEvent = async (
  organizationId,
  { title, date, time, location, description, imageUrl }
) => {
  if (!title) {
    throw createHttpError("Event title is required.", 400);
  }
  if (!date) {
    throw createHttpError("Event date is required.", 400);
  }

  const event = await Event.create({
    organizationId,
    title: title.trim(),
    date: new Date(date),
    time: time !== undefined ? time : "",
    location: location !== undefined ? location : "",
    description: description !== undefined ? description : "",
    imageUrl: imageUrl !== undefined ? imageUrl : ""
  });

  return event;
};

// Only these fields may be changed via the API — never organizationId or
// _id, so an admin can't move an event into (or out of) another tenant.
const MUTABLE_EVENT_FIELDS = ["title", "date", "time", "location", "description", "imageUrl"];

const updateEvent = async (organizationId, eventId, updates) => {
  const safeUpdates = {};
  for (const field of MUTABLE_EVENT_FIELDS) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = field === "date" ? new Date(updates[field]) : updates[field];
    }
  }

  const updatedEvent = await Event.findOneAndUpdate(
    { _id: eventId, organizationId },
    { $set: safeUpdates },
    { new: true }
  );

  if (!updatedEvent) {
    throw createHttpError("Event not found.", 404);
  }

  return updatedEvent;
};

const deleteEvent = async (organizationId, eventId) => {
  const result = await Event.deleteOne({ _id: eventId, organizationId });

  const deletedCount =
    result && typeof result.deletedCount === "number" ? result.deletedCount : 0;

  if (!deletedCount) {
    throw createHttpError("Event not found.", 404);
  }

  return { success: true };
};

const getUpcomingForOrg = async (organizationId, limit = 3) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return Event.find({ organizationId, date: { $gte: startOfToday } })
    .sort({ date: 1 })
    .limit(limit);
};

module.exports = {
  listForOrg,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingForOrg
};
