/**
 * Minimum bill amount gate suite (Epic B1).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Drives generate-qr with and without a configured
 * minimum, and confirms a sibling outlet is unaffected by this one's setting.
 *
 * Run directly: `node tests/min-bill-amount.js`
 */

const { bootServer } = require("./helpers/bootServer");
const { makeSiblingOutlet } = require("./helpers/makeOutlet");

const COMPANY = "coffesarowar";
const SLUG = "durbarmarg";

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5014 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, slug = SLUG, body } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (slug) { headers["X-Company-Slug"] = COMPANY; headers["X-Outlet-Slug"] = slug; }
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  };

  try {
    const adminLogin = await api("/api/admin-auth/login", {
      method: "POST",
      body: { email: "durbarmarg@coffesarowar.com", password: "password" },
    });
    const adminToken = adminLogin.body.token;

    const customerLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "asha@example.com", password: "password" },
    });
    const customerToken = customerLogin.body.token;

    // 1. Default (minBillAmount: 0) — generate-qr with no billAmount at all
    //    succeeds exactly as before this feature existed.
    const gen0 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken });
    check("gate disabled: generate-qr with no billAmount -> 201", gen0.status === 201);
    check("gate disabled: token present", Boolean(gen0.body?.data?.token));

    // 2. Enable the gate.
    const setMin = await api("/api/admin/settings", {
      method: "PATCH",
      token: adminToken,
      body: { program: { minBillAmount: 500 } },
    });
    check(
      "admin sets minBillAmount to 500",
      setMin.status === 200 && setMin.body.settings.program.minBillAmount === 500,
    );

    // 3. Below minimum -> 400, no token.
    const genLow = await api("/api/admin/generate-qr", {
      method: "POST",
      token: adminToken,
      body: { billAmount: 300 },
    });
    check("below minimum -> 400", genLow.status === 400);
    check("below minimum: no token in response", !genLow.body?.data?.token);

    // 4. Missing billAmount entirely -> 400.
    const genMissing = await api("/api/admin/generate-qr", { method: "POST", token: adminToken });
    check("missing billAmount when gate enabled -> 400", genMissing.status === 400);

    // 5. At minimum -> 201, and the token is genuinely claimable.
    const genOk = await api("/api/admin/generate-qr", {
      method: "POST",
      token: adminToken,
      body: { billAmount: 500 },
    });
    check("at minimum -> 201", genOk.status === 201);
    const claim = await api("/api/stamps/claim", {
      method: "POST",
      token: customerToken,
      body: { token: genOk.body?.data?.token },
    });
    check("token from valid generate-qr is claimable", claim.status === 200);

    // 6. Isolation + inheritance: a sibling outlet under the SAME company
    //    inherits the company's defaults, so this outlet's own
    //    minBillAmount override must not reach it.
    const sibling = await makeSiblingOutlet(baseUrl, { label: `mba${Date.now()}` });
    check("sibling outlet's admin logs in", Boolean(sibling.adminToken));
    const secondGen = await api("/api/admin/generate-qr", {
      method: "POST",
      slug: sibling.outletSlug,
      token: sibling.adminToken,
    });
    check("sibling outlet's generate-qr unaffected by this outlet's minBillAmount override", secondGen.status === 201);
  } finally {
    stop();
  }

  if (failures) { console.error(`min-bill-amount: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("min-bill-amount: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
