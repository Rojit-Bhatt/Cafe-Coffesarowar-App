/**
 * Customer detail drill-in suite (Epic D1).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Drives generate-qr with a bill amount through to a
 * claim, and confirms getCustomersList surfaces the new fields correctly.
 *
 * Run directly: `node tests/customer-detail.js`
 */

const { bootServer } = require("./helpers/bootServer");
const { makeSiblingOutlet } = require("./helpers/makeOutlet");

const COMPANY = "coffesarowar";
const SLUG = "durbarmarg";

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5016 });
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

    // Fresh customer for this run so counts start from zero.
    const email = `d1_${Date.now()}@test.co`;
    await api("/api/auth/register", {
      method: "POST",
      body: { name: "D1 Tester", email, password: "password", phone: "+9779811112222", address: "123 Test Lane" },
    });
    const mint = await api("/__test__/mint-token", { method: "POST", body: { email, type: "email_verify" } });
    await fetch(`${baseUrl}/api/auth/verify-email?token=${mint.body.token}`, { headers: { "X-Company-Slug": COMPANY, "X-Outlet-Slug": SLUG } });
    const customerLogin = await api("/api/auth/login", { method: "POST", body: { email, password: "password" } });
    const customerToken = customerLogin.body.token;

    // Remove the default cooldown so the three claims below aren't blocked
    // by "one stamp every 18 hours" (unrelated to this test's purpose).
    await api("/api/admin/settings", { method: "PATCH", token: adminToken, body: { program: { cooldownHours: 0 } } });

    // Claim 1: bill amount 500.
    const gen1 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken, body: { billAmount: 500 } });
    const claim1 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen1.body.data.token } });
    check("first claim succeeds", claim1.status === 200);

    // Claim 2: no bill amount at all (gate disabled by default on this tenant).
    const gen2 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken });
    const claim2 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen2.body.data.token } });
    check("second claim succeeds", claim2.status === 200);

    // Claim 3: bill amount 300.
    const gen3 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken, body: { billAmount: 300 } });
    const claim3 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen3.body.data.token } });
    check("third claim succeeds", claim3.status === 200);

    const list = await api("/api/admin/customers", { token: adminToken });
    const me = (list.body?.data || []).find((c) => c.email === email);
    check("customer found in list", Boolean(me));
    check("phone surfaced", me?.phone === "+9779811112222");
    check("address surfaced", me?.address === "123 Test Lane");
    check("totalSpent sums entered amounts, ignores the no-amount claim", me?.totalSpent === 800);
    check("lifetimeVoucherCount is 0 (no milestone reached yet)", me?.lifetimeVoucherCount === 0);
    check("scanHistory has 3 entries", Array.isArray(me?.scanHistory) && me.scanHistory.length === 3);

    // Tenant isolation: a 2nd tenant's customer list doesn't see this activity.
    // A sibling outlet under the SAME company — a stronger isolation test
    // than an unrelated business: these two share an owner and must still
    // leak nothing between them.
    const sibling = await makeSiblingOutlet(baseUrl, { label: `cd${Date.now()}` });
    const secondList = await api("/api/admin/customers", { slug: sibling.outletSlug, token: sibling.adminToken });
    check(
      "a sibling outlet's customer list has none of this outlet's customers",
      Array.isArray(secondList.body?.data) && secondList.body.data.every((c) => c.email !== email),
    );
  } finally {
    stop();
  }

  if (failures) { console.error(`customer-detail: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("customer-detail: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
