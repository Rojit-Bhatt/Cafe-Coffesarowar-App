const assert = require("assert");
const { bootServer } = require("./helpers/bootServer");

const SLUG = "coffesarowar";
const H = { "Content-Type": "application/json", "X-Tenant-Slug": SLUG };

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5013 });
  let failures = 0;
  const check = (name, cond) => { if (cond) console.log(`PASS ${name}`); else { console.error(`FAIL ${name}`); failures++; } };

  try {
    const email = `verify_${Date.now()}@test.co`;
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST", headers: H,
      body: JSON.stringify({ name: "V", email, password: "password", phone: "+9779812345678" })
    });
    const regBody = await reg.json();
    check("register returns success", reg.status === 201 && regBody.success === true);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST", headers: H, body: JSON.stringify({ email, password: "password" })
    });
    const loginBody = await login.json();
    check("login ok, emailVerified false", login.status === 200 && loginBody.user.emailVerified === false);
  } finally {
    stop();
  }
  if (failures) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
