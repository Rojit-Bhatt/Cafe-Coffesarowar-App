/**
 * Platform-admin business-edit suite. Self-contained: boots its own server
 * on a dedicated port against the in-memory mock DB.
 *
 * Covers: editing name/category, and the admin-email-fix flow (wrong email
 * entered at onboarding -> platform admin corrects it -> new address gets a
 * fresh, usable verification token; the OLD email's account no longer
 * exists under that email since the email field itself changed).
 *
 * Run directly: `node tests/platform-business-edit.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5023 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, body } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  };

  try {
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;

    const runSuffix = Date.now();
    const slug = `editme-${runSuffix}`;
    const wrongEmail = `wrong+${runSuffix}@typo.test`;
    const create = await api("/api/platform/businesses", {
      method: "POST",
      token: platformToken,
      body: {
        name: "Edit Me Cafe",
        slug,
        adminName: "Owner",
        adminEmail: wrongEmail,
        adminPassword: "password",
      },
    });
    check("onboard business -> 201", create.status === 201);
    const id = create.body.business.id;

    // 1. Edit name + category, no adminEmail change.
    const editNameCategory = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { name: "Edit Me Cafe (Renamed)", category: "bakery" },
    });
    check(
      "edit name+category -> 200 with new values",
      editNameCategory.status === 200 &&
        editNameCategory.body.business.name === "Edit Me Cafe (Renamed)" &&
        editNameCategory.body.business.category === "bakery",
    );

    // 2. Fix the wrong admin email.
    const correctEmail = `correct+${runSuffix}@real.test`;
    const editEmail = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { adminEmail: correctEmail },
    });
    check(
      "fix admin email -> 200, echoes new email",
      editEmail.status === 200 && editEmail.body.admin?.email === correctEmail,
    );

    // 3. The OLD (wrong) email can no longer log in as this business's admin.
    const loginOldReal = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": slug },
      body: JSON.stringify({ email: wrongEmail, password: "password" }),
    });
    check("old (wrong) email can no longer log in -> 401", loginOldReal.status === 401);

    // 4. The NEW (corrected) email can log in, and shows emailVerified:false
    //    (a fresh verification was required, exactly solving the "wasted
    //    route" problem).
    const loginNewReal = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": slug },
      body: JSON.stringify({ email: correctEmail, password: "password" }),
    });
    const loginNewBody = await loginNewReal.json();
    check(
      "corrected email logs in, emailVerified:false until they click the new link",
      loginNewReal.status === 200 && loginNewBody.user?.emailVerified === false,
    );

    // 5. A bogus category is rejected.
    const badCategory = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { category: "not-a-real-category" },
    });
    check("bogus category -> 400", badCategory.status === 400);

    // 6. Re-submitting the SAME (already-current) admin email is a no-op —
    //    doesn't reset emailVerified or resend anything.
    const editSameEmail = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { adminEmail: correctEmail },
    });
    check(
      "re-submitting the same admin email -> 200, no-op",
      editSameEmail.status === 200 && editSameEmail.body.admin?.email === correctEmail,
    );
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll platform-business-edit checks passed.");
  }
}

main();
