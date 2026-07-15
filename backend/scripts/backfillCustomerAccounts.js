/**
 * One-time migration: merges existing per-tenant customer User rows into the
 * new global CustomerAccount model.
 *
 * The same email can already exist as separate User rows across multiple
 * tenants (that was the whole model until now) — this groups by normalized
 * email and creates ONE CustomerAccount per group, linking every row's
 * customerAccountId and clearing that row's own password/googleId (so the
 * old shared /api/auth/login endpoint can no longer authenticate them with a
 * possibly-stale password once their real password lives on the global
 * account).
 *
 * Idempotent — filters on customerAccountId: null, so a re-run after a
 * partial failure only touches unmigrated rows.
 *
 * Usage:
 *   node backend/scripts/backfillCustomerAccounts.js [--dry-run]
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = require("../config/db");
const User = require("../models/User");
const CustomerAccount = require("../models/CustomerAccount");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

async function backfillCustomerAccounts() {
  const dryRun = process.argv.includes("--dry-run");

  await connectDB();

  const rows = await User.find({ role: "customer", customerAccountId: null });

  if (rows.length === 0) {
    console.log("Nothing to migrate — no unmigrated customer rows found.");
    await mongoose.connection.close();
    return;
  }

  const groups = new Map();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(row);
  }

  console.log(`Found ${rows.length} unmigrated customer row(s) across ${groups.size} unique email(s).`);

  let accountsCreated = 0;
  let rowsLinked = 0;

  for (const [email, group] of groups) {
    group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const name = group[0].name;
    const phone = (group.find((r) => r.phone) || {}).phone || "";
    const password = (group.find((r) => r.password) || {}).password || null;
    const googleId = (group.find((r) => r.googleId) || {}).googleId || null;
    const emailVerified = group.some((r) => r.emailVerified === true);

    if (dryRun) {
      console.log(
        `[dry-run] ${email}: would create 1 CustomerAccount from ${group.length} row(s) ` +
          `(name="${name}", phone="${phone}", hasPassword=${Boolean(password)}, hasGoogleId=${Boolean(googleId)}, emailVerified=${emailVerified})`
      );
      continue;
    }

    const account = await CustomerAccount.create({ name, email, phone, password, googleId, emailVerified });
    accountsCreated += 1;

    for (const row of group) {
      row.customerAccountId = account._id;
      // Clear the now-legacy per-tenant copy — the real credential lives on
      // the global account going forward.
      row.password = undefined;
      row.googleId = null;
      await row.save();
      rowsLinked += 1;
    }
  }

  if (dryRun) {
    console.log(`[dry-run] Would create ${groups.size} CustomerAccount(s) linking ${rows.length} row(s). No changes made.`);
  } else {
    console.log(`Created ${accountsCreated} CustomerAccount(s), linked ${rowsLinked} membership row(s).`);
  }

  await mongoose.connection.close();
}

backfillCustomerAccounts().catch((err) => {
  console.error("Backfill failed:", err);
  mongoose.connection.close();
  process.exit(1);
});
