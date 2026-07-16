const { listAdmins, inviteAdmin, removeAdmin } = require("../services/platformTeamService");
const User = require("../models/User");

const getAdmins = async (req, res, next) => {
  try {
    const admins = await listAdmins();
    res.status(200).json({ success: true, admins });
  } catch (error) {
    next(error);
  }
};

const postAdmin = async (req, res, next) => {
  try {
    const { name, email, password, platformRole } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const admin = await inviteAdmin({
      name,
      email,
      password,
      platformRole,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(201).json({ success: true, admin });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = await User.findOne({ _id: req.user.id });
    await removeAdmin({ id, actorId: req.user.id, actorName: actor ? actor.name : "Unknown" });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdmins, postAdmin, deleteAdmin };
