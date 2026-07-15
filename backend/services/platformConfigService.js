const PlatformConfig = require("../models/PlatformConfig");

// findOneAndUpdate with upsert:true and an empty update means "create with
// schema defaults if the singleton doesn't exist yet, otherwise return it
// as-is" — one call handles both "never configured" and "already configured".
const getConfig = () =>
  PlatformConfig.findOneAndUpdate(
    { singleton: true },
    {},
    { upsert: true, new: true }
  );

const getContact = async () => {
  const config = await getConfig();
  return config.contact;
};

const updateContact = async (patch) => {
  const config = await getConfig();
  const updatedContact = {
    ...config.contact,
    ...patch
  };

  const updated = await PlatformConfig.findOneAndUpdate(
    { singleton: true },
    { $set: { contact: updatedContact } },
    { upsert: true, new: true }
  );

  return updated.contact;
};

module.exports = {
  getContact,
  updateContact
};
