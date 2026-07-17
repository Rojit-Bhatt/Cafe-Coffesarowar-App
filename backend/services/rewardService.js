const RewardItem = require("../models/RewardItem");
const { toCenti, toPoints } = require("../utils/pointsMath");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Centipoints never leave the backend — every read converts once, here.
const format = (r) => ({
  id: r._id.toString(),
  name: r.name,
  description: r.description || "",
  imageUrl: r.imageUrl || "",
  pointsPrice: toPoints(r.pointsPriceCenti),
  isActive: r.isActive,
  sortOrder: r.sortOrder
});

const parseInput = (body) => {
  const name = String(body.name || "").trim();
  if (!name) throw createHttpError("Give the reward a name.", 400);

  const pointsPrice = Number(body.pointsPrice);
  if (!Number.isFinite(pointsPrice) || pointsPrice < 0) {
    throw createHttpError("Set what this costs in points.", 400);
  }

  return {
    name,
    description: String(body.description || "").trim(),
    imageUrl: String(body.imageUrl || "").trim(),
    pointsPriceCenti: toCenti(pointsPrice),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
  };
};

const listRewards = async (organizationId) => {
  const rows = await RewardItem.find({ organizationId }).sort({ sortOrder: 1 });
  return rows.map(format);
};

const createReward = async (organizationId, body) => {
  const created = await RewardItem.create({ organizationId, ...parseInput(body) });
  return format(created);
};

const updateReward = async (organizationId, id, body) => {
  // Scoped by organizationId, so an id from another outlet matches nothing.
  const reward = await RewardItem.findOne({ _id: id, organizationId });
  if (!reward) throw createHttpError("Reward not found.", 404);

  // A bare isActive toggle shouldn't have to re-send the whole reward.
  if (Object.keys(body).length === 1 && body.isActive !== undefined) {
    reward.isActive = Boolean(body.isActive);
    await reward.save();
    return format(reward);
  }

  Object.assign(reward, parseInput({ ...format(reward), ...body }));
  await reward.save();
  return format(reward);
};

// Hard delete. Safe because PointsTransaction denormalizes rewardName — a
// past redemption still says what was handed over even with the row gone.
// Deactivating is still the kinder option and is what the UI offers first.
const deleteReward = async (organizationId, id) => {
  const reward = await RewardItem.findOne({ _id: id, organizationId });
  if (!reward) throw createHttpError("Reward not found.", 404);
  await RewardItem.deleteOne({ _id: reward._id });
  return { success: true };
};

module.exports = { listRewards, createReward, updateReward, deleteReward };
