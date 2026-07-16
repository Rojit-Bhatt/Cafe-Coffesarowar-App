// Test helpers for provisioning outlets through the real company flow.
//
// Most suites just need "a second isolated tenant to prove nothing leaks".
// Before the company restructure that was one call to the platform's
// onboard-a-business endpoint; now an outlet lives under a company, so these
// keep that setup to one line at the call site.

const makeApi = (baseUrl) => (path, { method = "GET", token, company, outlet, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (company) headers["X-Company-Slug"] = company;
  if (outlet) headers["X-Outlet-Slug"] = outlet;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};

const verifyAdmin = async (api, email) => {
  const mint = await api("/__test__/mint-admin-token", {
    method: "POST",
    body: { email, type: "email_verify" },
  });
  await api(`/api/admin-auth/verify-email?token=${mint.body.token}`);
};

const login = (api, email, password = "password") =>
  api("/api/admin-auth/login", { method: "POST", body: { email, password } });

// A second outlet under the SEEDED company (coffesarowar), which has a
// comped plan with slots to spare. Preferred for isolation tests: two
// outlets of ONE company share an owner and must STILL leak nothing between
// them, which is strictly stronger than isolating two unrelated businesses.
// Returns { outletSlug, outletId, adminEmail, adminToken }.
// `verify: false` leaves the new outlet's admin unverified — for suites that
// test the verification flow itself. Note an unverified admin can't sign in,
// so adminToken comes back null in that case.
async function makeSiblingOutlet(baseUrl, {
  label = `s${Date.now()}${Math.floor(Math.random() * 1000)}`,
  category = "cafe",
  verify = true,
} = {}) {
  const api = makeApi(baseUrl);

  const ownerLogin = await login(api, "owner@coffesarowar.com");
  const outletSlug = `outlet-${label}`;
  const adminEmail = `admin-${label}@test.com`;

  const created = await api("/api/company/outlets", {
    method: "POST",
    token: ownerLogin.body.token,
    body: {
      name: `Outlet ${label}`,
      slug: outletSlug,
      category,
      adminName: `Admin ${label}`,
      adminEmail,
      adminPassword: "password",
    },
  });

  let adminToken = null;
  if (verify) {
    await verifyAdmin(api, adminEmail);
    const adminLogin = await login(api, adminEmail);
    adminToken = adminLogin.body?.token;
  }

  return {
    outletSlug,
    outletId: created.body?.outlet?.id,
    adminEmail,
    adminToken,
    ownerToken: ownerLogin.body.token,
  };
}

// A whole separate company with one outlet — for the cases that genuinely
// need a different COMPANY, not just a different outlet (cross-company
// isolation, per-company subscriptions).
// Returns { companySlug, outletSlug, ownerEmail, ownerToken, adminEmail, adminToken, platformToken }.
async function makeCompanyWithOutlet(baseUrl, {
  platformToken,
  label = `c${Date.now()}${Math.floor(Math.random() * 1000)}`,
  category = "cafe",
  withOutlet = true,
} = {}) {
  const api = makeApi(baseUrl);

  let token = platformToken;
  if (!token) {
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    token = platformLogin.body.token;
  }

  const companySlug = `co-${label}`;
  const ownerEmail = `owner-${label}@test.com`;
  const adminEmail = `admin-${label}@test.com`;

  await api("/api/platform/companies", {
    method: "POST",
    token,
    body: {
      name: `Company ${label}`,
      slug: companySlug,
      ownerName: `Owner ${label}`,
      ownerEmail,
      ownerPassword: "password",
    },
  });
  await verifyAdmin(api, ownerEmail);
  const ownerLogin = await login(api, ownerEmail);

  const result = {
    companySlug,
    ownerEmail,
    ownerToken: ownerLogin.body.token,
    platformToken: token,
  };

  if (!withOutlet) return result;

  const created = await api("/api/company/outlets", {
    method: "POST",
    token: result.ownerToken,
    body: {
      name: `Outlet ${label}`,
      slug: "main",
      category,
      adminName: `Admin ${label}`,
      adminEmail,
      adminPassword: "password",
    },
  });
  await verifyAdmin(api, adminEmail);
  const adminLogin = await login(api, adminEmail);

  return {
    ...result,
    outletSlug: "main",
    outletId: created.body?.outlet?.id,
    adminEmail,
    adminToken: adminLogin.body?.token,
  };
}

module.exports = { makeApi, makeSiblingOutlet, makeCompanyWithOutlet, verifyAdmin };
