const {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign
} = require("../services/campaignService");

const list = async (req, res, next) => {
  try {
    const data = await listCampaigns(req.user.organizationId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const campaign = await createCampaign(req.user.organizationId, req.body);
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const campaign = await updateCampaign(req.user.organizationId, req.params.id, req.body);
    res.status(200).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await deleteCampaign(req.user.organizationId, req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
