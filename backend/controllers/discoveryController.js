const { getDiscoverBusinesses } = require("../services/discoveryService");

const discover = async (req, res, next) => {
  try {
    const result = await getDiscoverBusinesses();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { discover };
