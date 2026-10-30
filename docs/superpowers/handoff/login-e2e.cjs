// Throwaway: the api-smoke sign-in steps on dev, without the time-dependent cart/checkout. Not project code.
const webDir = process.argv[2];
const { chromium } = require(require.resolve("playwright", { paths: [webDir] }));
const AxeBuilder = require(require.resolve("@axe-core/playwright", { paths: [webDir] })).default;
const { createHmac } = require("node:crypto");
const base = "http://43.159.54.222";
const secret = process.env.STAFF_TOTP_SECRET;

function totp(now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  const results = [];
  const step = async (name, fn) => {
    try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); throw e; }
  };
  try {
    await step("home shows API catalogue", async () => {
      await page.goto(base, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Kabel USB-C ke USB-C 100W Braided" }).first().waitFor({ timeout: 20_000 });
    });
    await step("axe: 0 serious/critical on home", async () => {
      const axe = await new AxeBuilder({ page }).analyze();
      const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      if (bad.length) throw new Error(bad.map((v) => v.id).join(","));
    });
    await step("customer signs in", async () => {
      await page.getByRole("link", { name: "Masuk" }).click();
      await page.locator("#email").fill("rina@example.com");
      await page.locator("#password").fill("demo-rina-2026");
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.getByRole("heading", { name: "Akun" }).waitFor({ timeout: 20_000 });
    });
    await step("customer cookie is HttpOnly, SameSite=Lax, 7 days", async () => {
      const c = (await page.context().cookies()).find((x) => x.name === "tian_session");
      if (!c || !c.httpOnly || c.sameSite !== "Lax" || c.expires < Date.now() / 1000 + 6 * 86400) throw new Error(JSON.stringify({ httpOnly: c?.httpOnly, sameSite: c?.sameSite, expires: c?.expires }));
    });
    await step("customer stays signed in after reload", async () => {
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Akun" }).waitFor({ timeout: 20_000 });
    });
    await step("customer stays signed in on a typed URL (/akun/pesanan)", async () => {
      await page.goto(`${base}/akun/pesanan`, { waitUntil: "networkidle" });
      if (!page.url().endsWith("/akun/pesanan")) throw new Error(`landed on ${page.url()}`);
    });
    await step("owner signs in with the rotated authenticator code", async () => {
      await page.goto(`${base}/admin/login`);
      await page.locator("#a-email").fill("andi@toko.example");
      await page.locator("#a-pw").fill("demo-staff-2026");
      await page.locator("#a-otp").fill(totp());
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.getByText("Rp2.097.000").waitFor({ timeout: 20_000 });
    });
    await step("staff cookie is HttpOnly and ends with the browser session", async () => {
      const c = (await page.context().cookies()).find((x) => x.name === "tian_staff");
      if (!c || !c.httpOnly || c.expires !== -1) throw new Error(JSON.stringify({ httpOnly: c?.httpOnly, expires: c?.expires }));
    });
    await step("owner stays signed in after reload", async () => {
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText("Rp2.097.000").waitFor({ timeout: 20_000 });
    });
    await step("owner signs out", async () => {
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/v1/admin/auth/sign-out")),
        page.getByRole("button", { name: "Keluar" }).click(),
      ]);
      await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/admin\/login$/, { timeout: 10_000 });
    });
    await step("CS signs in (no dashboard access) and lands on orders", async () => {
      await page.locator("#a-email").fill("cs@toko.example");
      await page.locator("#a-pw").fill("demo-staff-2026");
      await page.locator("#a-otp").fill(totp());
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.waitForURL(/\/admin\/orders$/, { timeout: 20_000 });
    });
    await step("Marketing signs in (no orders access) and sees the dashboard", async () => {
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/v1/admin/auth/sign-out")),
        page.getByRole("button", { name: "Keluar" }).click(),
      ]);
      await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
      await page.locator("#a-email").fill("rina.m@toko.example");
      await page.locator("#a-pw").fill("demo-staff-2026");
      await page.locator("#a-otp").fill(totp());
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.getByText("Rp2.097.000").waitFor({ timeout: 20_000 });
    });
    console.log("login-e2e ok");
  } catch {
    process.exitCode = 1;
  } finally {
    console.log(results.join("\n"));
    await browser.close();
  }
})();
