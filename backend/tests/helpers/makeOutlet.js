// Provisions a fresh, fully-usable outlet for a test: registers a company +
// owner via the platform, verifies both emails, creates the outlet with its
// own credentials, and hands back everything a suite needs to act as either
// the owner or the outlet admin.
//
// Most suites just want "a second isolated tenant to prove nothing leaks".
// Before the company restructure that was one call to the platform's
// onboard-a-business endpoint; now it's a company and an outlet under it, so
// this helper keeps that setup to one line at the call site.
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

// Returns { companySlug, outletSlug, outletId, ownerEmail, ownerToken,
//           adminEmail, adminToken }
async function makeOutlet(baseUrl, {
  platformToken,
  label = `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
  category = "cafe",
  password = "password",
} = {}) {
  const api = makeApi(baseUrl);

  let token = platformToken;
  if (!token) {
    const login = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    token = login.body.token;
  }

  const companySlug = `co-${label}`;
  const outletSlug = "main";
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
      ownerPassword: password,
    },
  });
  await verifyAdmin(api, ownerEmail);

  const ownerLogin = await api("/api/admin-auth/login", {
    method: "POST",
    body: { email: ownerEmail, password },
  });
  const ownerToken = ownerLogin.body.token;

  const created = await api("/api/company/outlets", {
    method: "POST",
    token: ownerToken,
    body: {
      name: `Outlet ${label}`,
      slug: outletSlug,
      category,
      adminName: `Admin ${label}`,
      adminEmail,
      adminPassword: password,
    },
  });
  await verifyAdmin(api, adminEmail);

  const adminLogin = await api("/api/admin-auth/login", {
    method: "POST",
    body: { email: adminEmail, password },
  });

  return {
    companySlug,
    outletSlug,
    outletId: created.body?.outlet?.id,
    ownerEmail,
    ownerToken,
    adminEmail,
    adminToken: adminLogin.body?.token,
    platformToken: token,
  };
}

module.exports = { makeOutlet, makeApi };
