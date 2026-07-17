const {
  listRewards,
  createReward,
  updateReward,
  deleteReward
} = require("../services/rewardService");

const list = async (req, res, next) => {
  try {
    const data = await listRewards(req.user.organizationId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const reward = await createReward(req.user.organizationId, req.body);
    res.status(201).json({ success: true, reward });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const reward = await updateReward(req.user.organizationId, req.params.id, req.body);
    res.status(200).json({ success: true, reward });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await deleteReward(req.user.organizationId, req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
