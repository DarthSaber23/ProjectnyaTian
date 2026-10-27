import { createHmac } from "node:crypto";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:8081";
const secret = process.env.STAFF_TOTP_SECRET;
if (!secret) throw new Error("Set STAFF_TOTP_SECRET to the API server's value (server/.env).");

function totp(now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Math.floor(now / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
};

async function go(path) {
  await page.evaluate((next) => {
    window.history.pushState({}, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

try {
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Kabel USB-C ke USB-C 100W Braided" }).first().waitFor({ timeout: 20_000 });

const axe = await new AxeBuilder({ page }).analyze();
const serious = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
if (serious.length) await fail(`axe ${serious.map((item) => item.id).join(",")}`);

await page.getByRole("link", { name: "Masuk" }).click();
await page.locator("#email").fill("rina@example.com");
await page.locator("#password").fill("demo-rina-2026");
await page.getByRole("button", { name: "Masuk" }).click();
await page.getByRole("heading", { name: "Akun" }).waitFor({ timeout: 20_000 });
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Akun" }).waitFor({ timeout: 20_000 }).catch(() => fail("Customer was signed out by a page reload"));

await go("/keranjang");
while (await page.getByRole("button", { name: "Hapus" }).count()) {
  await page.getByRole("button", { name: "Hapus" }).first().click();
}

await go("/produk/kabel-usb-c-100w-braided");
await page.getByRole("button", { name: /2 m · Hitam/ }).click();
await page.getByRole("button", { name: "Tambah jumlah" }).click();
await page.getByRole("button", { name: /\+ Keranjang/ }).first().click();
await go("/produk/charger-gan-65w-3-port");
await page.getByRole("heading", { name: "Charger GaN 65W 3 Port" }).waitFor();
await page.getByRole("button", { name: /\+ Keranjang/ }).first().click();
await go("/keranjang");
await page.locator("#voucher").waitFor();
for (const code of ["KABEL10", "GRATISONGKIR"]) {
  await page.locator("#voucher").fill(code);
  await page.getByRole("button", { name: "Pakai" }).click();
  await page.getByText(`${code} dipasang`).waitFor({ timeout: 15_000 });
}
await page.getByRole("button", { name: "Lanjut ke pengiriman" }).click();
await page.getByRole("button", { name: /Lanjut ke ringkasan · Rp587\.250/ }).waitFor({ timeout: 20_000 });
await page.getByRole("button", { name: /Lanjut ke ringkasan · Rp587\.250/ }).click();
await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
await page.getByRole("button", { name: /Buat pesanan · Rp587\.250/ }).click();
await page.waitForURL(/\/pembayaran\/ORD-/);
if (await page.getByText("Pembayaran diterima").count()) await fail("Payment page showed paid before an event");

await page.goto(`${base}/admin/login`);
await page.locator("#a-email").fill("andi@toko.example");
await page.locator("#a-pw").fill("demo-staff-2026");
await page.locator("#a-otp").fill(totp());
await page.getByRole("button", { name: "Masuk" }).click();
await page.getByText("Rp2.097.000").waitFor({ timeout: 20_000 });
await page.reload({ waitUntil: "networkidle" });
await page.getByText("Rp2.097.000").waitFor({ timeout: 20_000 }).catch(() => fail("Staff was signed out by a page reload"));

await Promise.all([
  page.waitForResponse((response) => response.url().endsWith("/v1/admin/auth/sign-out")),
  page.getByRole("button", { name: "Keluar" }).click(),
]);
await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
await page.locator("#a-email").fill("cs@toko.example");
await page.locator("#a-pw").fill("demo-staff-2026");
await page.locator("#a-otp").fill(totp());
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForURL(/\/admin\/orders$/, { timeout: 20_000 }).catch(() => fail("CS could not sign in to the admin"));
console.log("api-smoke ok");
} finally {
  await browser.close();
}
