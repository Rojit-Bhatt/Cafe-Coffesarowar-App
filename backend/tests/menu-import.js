/**
 * Excel menu import suite (Epic C1).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Builds a small .xlsx buffer in-process (via xlsx) with
 * a mix of valid/invalid rows, POSTs it as multipart form data, and checks
 * the import counts, the resulting menu, and the template download.
 *
 * Run directly: `node tests/menu-import.js`
 */

const XLSX = require("xlsx");
const { bootServer } = require("./helpers/bootServer");

const SLUG = "coffesarowar";

function buildTestWorkbook() {
  const aoa = [
    ["Name", "Price", "Category", "Description"],
    ["Cappuccino", "₹150", "Coffee", "Rich and creamy espresso with steamed milk"],
    ["Croissant", "", "", ""],
    ["", "₹50", "Bakery", "Missing name, should be skipped"],
    ["", "", "", ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Menu");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5015 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, slug = SLUG, body, headers = {} } = {}) => {
    const h = { ...headers };
    if (slug) h["X-Tenant-Slug"] = slug;
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined && !(body instanceof FormData)) {
      h["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, { method, headers: h, body }).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
      raw: r,
    }));
  };

  try {
    const adminLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "barista@mansarowar.cafe", password: "password" },
    });
    const adminToken = adminLogin.body.token;

    // 1. Import a mixed valid/invalid workbook.
    const buf = buildTestWorkbook();
    const form = new FormData();
    form.append(
      "file",
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "menu.xlsx",
    );
    const importRes = await api("/api/admin/menu/import", { method: "POST", token: adminToken, body: form });
    check("import -> 200", importRes.status === 200);
    check("imported 2 valid rows", importRes.body?.imported === 2);
    check("skipped 2 invalid rows", importRes.body?.skipped === 2);

    // 2. The imported items now show up in the admin menu list.
    const listRes = await api("/api/admin/menu", { token: adminToken });
    const names = (listRes.body?.items || []).map((i) => i.name);
    check("Cappuccino imported", names.includes("Cappuccino"));
    check("Croissant imported", names.includes("Croissant"));
    const cappuccino = (listRes.body?.items || []).find((i) => i.name === "Cappuccino");
    check("imported item is available by default", cappuccino?.isAvailable === true);
    check("blank category defaults to General", (listRes.body?.items || []).find((i) => i.name === "Croissant")?.category === "General");

    // 3. Wrong file type is rejected.
    const badForm = new FormData();
    badForm.append("file", new Blob(["not a spreadsheet"], { type: "text/plain" }), "notes.txt");
    const badTypeRes = await api("/api/admin/menu/import", { method: "POST", token: adminToken, body: badForm });
    check("wrong file type -> 400", badTypeRes.status === 400);

    // 4. No file attached is rejected.
    const noFileRes = await api("/api/admin/menu/import", { method: "POST", token: adminToken, body: new FormData() });
    check("no file -> 400", noFileRes.status === 400);

    // 5. Template download round-trips through xlsx.
    const templateRes = await fetch(`${baseUrl}/api/admin/menu/template`, {
      headers: { Authorization: `Bearer ${adminToken}`, "X-Tenant-Slug": SLUG },
    });
    check("template -> 200", templateRes.status === 200);
    const templateBuf = Buffer.from(await templateRes.arrayBuffer());
    const templateWb = XLSX.read(templateBuf, { type: "buffer" });
    const templateSheet = templateWb.Sheets[templateWb.SheetNames[0]];
    const templateRows = XLSX.utils.sheet_to_json(templateSheet, { header: 1 });
    check(
      "template has the right header row",
      JSON.stringify(templateRows[0]) === JSON.stringify(["Name", "Price", "Category", "Description"]),
    );

    // 6. Tenant isolation: importing into coffesarowar doesn't touch another tenant.
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      slug: undefined,
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;
    const runSuffix = Date.now();
    const secondSlug = `brewhaven-${runSuffix}`;
    const secondAdminEmail = `boss+${runSuffix}@brewhaven.test`;
    await api("/api/platform/businesses", {
      method: "POST",
      slug: undefined,
      token: platformToken,
      body: {
        name: "Brew Haven",
        slug: secondSlug,
        adminName: "Haven Boss",
        adminEmail: secondAdminEmail,
        adminPassword: "password",
      },
    });
    const secondLogin = await api("/api/auth/login", {
      method: "POST",
      slug: secondSlug,
      body: { email: secondAdminEmail, password: "password" },
    });
    const secondList = await api("/api/admin/menu", { slug: secondSlug, token: secondLogin.body.token });
    check(
      "second tenant's menu unaffected by coffesarowar's import",
      Array.isArray(secondList.body?.items) && secondList.body.items.length === 0,
    );
  } finally {
    stop();
  }

  if (failures) { console.error(`menu-import: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("menu-import: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
