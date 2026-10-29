// Product photo checks against a deployed origin (dev). Run: BASE=http://<host> STAFF_TOTP_SECRET=… node e2e/photos-dev.mjs
// Uses the seeded demo staff (shared demo password, server TOTP secret). Uploads two photos to B01, checks the storefront
// and admin, then deletes them again. Prints N/N and exits non-zero on any failure.
import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const BASE = (process.env.BASE ?? "").replace(/\/$/, "");
const SECRET = process.env.STAFF_TOTP_SECRET ?? "";
const PASSWORD = "demo-staff-2026";
if (!BASE || !SECRET) {
  console.error("Set BASE and STAFF_TOTP_SECRET.");
  process.exit(2);
}
const B01_SLUG = "kabel-usb-c-100w-braided";
const LINKED_SKU = "B01-3M-BLK"; // in stock, so its variant button is selectable

function totp(now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of SECRET.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(true);
    console.log(`PASS ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    results.push(false);
    console.log(`FAIL ${name}: ${String(error?.message ?? error).split("\n")[0]}`);
  }
}
const assert = (ok, message) => { if (!ok) throw new Error(message); };

async function staffContext(browser, email) {
  const context = await browser.newContext({ baseURL: BASE });
  const res = await context.request.post("/v1/admin/auth/sign-in", { data: { email, password: PASSWORD, totp: totp() } });
  assert(res.ok(), `${email} sign-in ${res.status()}`);
  return context;
}

async function uiSignIn(page, email) {
  await page.goto(`${BASE}/admin/login`);
  await page.locator("#a-email").fill(email);
  await page.locator("#a-pw").fill(PASSWORD);
  await page.locator("#a-otp").fill(totp());
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.getByRole("button", { name: "Keluar" }).waitFor({ timeout: 20_000 });
}

/** A solid-colour JPEG drawn by the browser, so no image library is needed here. */
async function jpeg(page, colour) {
  const b64 = await page.evaluate((fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 800, 800);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(200, 200, 400, 400);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, colour);
  return Buffer.from(b64, "base64");
}

async function cls(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return page.evaluate(() => new Promise((resolve) => {
    let total = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; })
      .observe({ type: "layout-shift", buffered: true });
    setTimeout(() => resolve(total), 300);
  }));
}

const browser = await chromium.launch();
const uploaded = [];
let marketing;
try {
  marketing = await staffContext(browser, "rina.m@toko.example");
  const scratch = await marketing.newPage();
  await scratch.goto(BASE);
  const files = [await jpeg(scratch, "#1f5ae0"), await jpeg(scratch, "#d23a3a")];

  await check("marketing uploads two JPEGs to B01 (201)", async () => {
    for (const [i, buffer] of files.entries()) {
      const res = await marketing.request.post("/v1/admin/products/B01/images", {
        multipart: { alt: `Foto uji ${i + 1}`, rightsConfirmed: "true", file: { name: `uji-${i + 1}.jpg`, mimeType: "image/jpeg", buffer } },
      });
      assert(res.status() === 201, `upload ${i + 1}: ${res.status()} ${await res.text()}`);
      uploaded.push(await res.json());
    }
    return uploaded.map((u) => u.id).join(", ");
  });

  await check(`marketing links photo 2 to ${LINKED_SKU}`, async () => {
    const res = await marketing.request.put(`/v1/admin/variants/${LINKED_SKU}/image`, { data: { imageId: uploaded[1]?.id ?? null } });
    assert(res.ok(), `${res.status()} ${await res.text()}`);
  });

  await check("uploaded file is served as immutable WebP without MinIO headers", async () => {
    const res = await marketing.request.get(uploaded[0].src);
    const h = res.headers();
    assert(res.status() === 200, `status ${res.status()}`);
    assert(h["content-type"] === "image/webp", `type ${h["content-type"]}`);
    assert(h["cache-control"] === "public, max-age=31536000, immutable", `cache ${h["cache-control"]}`);
    const leaked = Object.keys(h).filter((k) => k.startsWith("x-amz") || k.startsWith("x-minio"));
    assert(leaked.length === 0, `leaked ${leaked.join(",")}`);
  });

  // Let the catalogue cache (15 s + 45 s) pass so the storefront sees the new photos.
  await new Promise((r) => setTimeout(r, 61_000));

  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await shopper.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await check("product page main photo loads (naturalWidth > 0)", async () => {
    await page.goto(`${BASE}/produk/${B01_SLUG}`, { waitUntil: "networkidle" });
    const main = page.locator(`img[src="${uploaded[0].src}"]`).first();
    await main.waitFor({ timeout: 20_000 });
    assert(await main.evaluate((img) => img.complete && img.naturalWidth > 0), "main photo not loaded");
  });

  await check("thumbnails switch the main photo", async () => {
    const group = page.getByRole("group", { name: "Galeri foto" });
    await group.waitFor({ timeout: 10_000 });
    await group.getByRole("button", { name: "Foto 2 dari 2" }).click();
    await page.locator(`img[src="${uploaded[1].src}"]`).first().waitFor({ timeout: 5_000 });
    assert(await group.getByRole("button", { name: "Foto 2 dari 2" }).getAttribute("aria-pressed") === "true", "thumb 2 not pressed");
    await group.getByRole("button", { name: "Foto 1 dari 2" }).click();
  });

  await check("choosing the linked variant shows its photo", async () => {
    await page.getByRole("button", { name: /3 m · Hitam/ }).click();
    await page.locator(`img[src="${uploaded[1].src}"]`).first().waitFor({ timeout: 5_000 });
  });

  await check("no 'Foto contoh' caption on uploaded photos", async () => {
    assert((await page.getByText("Foto contoh", { exact: true }).count()) === 0, "caption shown");
  });

  await check("axe: 0 serious/critical on the product page", async () => {
    const axe = await new AxeBuilder({ page }).analyze();
    const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    assert(bad.length === 0, bad.map((v) => v.id).join(","));
  });

  // The dev client build has no brand switch (demo tools off), so the Sambung sample B07 stands in for A02.
  await check("seeded sample (B07) shows 'Foto contoh'", async () => {
    const catalog = await (await shopper.request.get(`${BASE}/v1/catalog?brand=sambung`)).json();
    const b07 = (catalog.products ?? []).find((p) => p.id === "B07");
    assert(b07?.images?.[0]?.sample === true, "B07 has no sample photo in the catalogue");
    await page.goto(`${BASE}/produk/${b07.slug}`, { waitUntil: "networkidle" });
    await page.getByText("Foto contoh", { exact: true }).waitFor({ timeout: 10_000 });
  });

  await check("CLS 0.00 on the B01 product page and its category page at 390 px", async () => {
    const product = await cls(page, `${BASE}/produk/${B01_SLUG}`);
    const href = await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link").nth(1).getAttribute("href");
    const category = await cls(page, `${BASE}${href}`);
    assert(product < 0.005 && category < 0.005, `product ${product.toFixed(3)}, category ${category.toFixed(3)}`);
    return `product ${product.toFixed(3)}, category ${category.toFixed(3)}`;
  });

  const ops = await staffContext(browser, "dewi@toko.example");
  await check("operations gets 403 from the admin photo API", async () => {
    const res = await ops.request.get("/v1/admin/products");
    assert(res.status() === 403, `status ${res.status()}`);
  });
  await ops.close();

  await check("operations has no Produk menu and sees 'Tidak ada akses'", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await uiSignIn(p, "dewi@toko.example");
    assert((await p.getByRole("link", { name: "Produk", exact: true }).count()) === 0, "Produk link visible");
    await p.goto(`${BASE}/admin/products`);
    await p.getByRole("heading", { name: "Tidak ada akses" }).waitFor({ timeout: 10_000 });
    await ctx.close();
  });

  await check("owner sees Produk and the photo manager passes axe", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await uiSignIn(p, "andi@toko.example");
    await p.getByRole("link", { name: "Produk", exact: true }).click();
    await p.getByRole("heading", { name: "Produk", exact: true }).waitFor();
    await p.goto(`${BASE}/admin/products/B01`);
    await p.getByRole("heading", { name: /Kabel USB-C ke USB-C/ }).waitFor({ timeout: 10_000 });
    await p.screenshot({ path: "e2e/shot-admin-photos.png", fullPage: true });
    const axe = await new AxeBuilder({ page: p }).analyze();
    const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    await ctx.close();
    assert(bad.length === 0, bad.map((v) => v.id).join(","));
  });

  await check("after deleting both photos the product page falls back to the drawing without an error loop", async () => {
    for (const image of uploaded.splice(0)) {
      const res = await marketing.request.delete(`/v1/admin/products/B01/images/${image.id}`);
      assert(res.ok(), `delete ${res.status()}`);
    }
    await new Promise((r) => setTimeout(r, 61_000));
    consoleErrors.length = 0;
    await page.goto(`${BASE}/produk/${B01_SLUG}`, { waitUntil: "networkidle" });
    await page.getByRole("img", { name: /^Ilustrasi / }).first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(2000);
    assert(consoleErrors.length <= 2, `${consoleErrors.length} console errors`);
  });
  await shopper.close();
} finally {
  if (marketing) {
    for (const image of uploaded) await marketing.request.delete(`/v1/admin/products/B01/images/${image.id}`).catch(() => undefined);
    await marketing.request.put(`/v1/admin/variants/${LINKED_SKU}/image`, { data: { imageId: null } }).catch(() => undefined);
    await marketing.close();
  }
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
