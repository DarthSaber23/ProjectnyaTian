// M8 QA: responsive overflow at 360/768/1280, keyboard focus trap, axe on remaining screens.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const base = pathToFileURL(resolve("dist-preview/index.html")).href;
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const signIn = async (page) => {
  await page.goto(base + "#/masuk");
  await page.getByRole("button", { name: "Isi kredensial demo" }).click();
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForTimeout(100);
};
const staffIn = async (page, who) => {
  await page.goto(base + "#/admin/login");
  await page.getByRole("button", { name: new RegExp(who) }).click();
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForTimeout(100);
};
const routes = ["", "kategori/semua", "kategori/kabel", "produk/kabel-usb-c-100w-braided", "produk/bundel-rutinitas-pagi", "keranjang", "cari?q=hdmi", "masuk"];
const authRoutes = ["akun", "akun/pesanan", "akun/pesanan/ORD-261014-0003", "akun/wishlist", "akun/preferensi"];
const adminRoutes = ["admin", "admin/orders", "admin/orders/ORD-261020-0009", "admin/promotions", "admin/audit-log"];

for (const w of [360, 768, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();
  const overflow = async (label) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${w}px no horizontal scroll · ${label}`, o <= 0, o > 0 ? `${o}px` : "");
  };
  for (const r of routes) { await page.goto(base + "#/" + r); await page.waitForTimeout(60); await overflow(r || "home"); }
  await page.getByRole("button", { name: "Halimun" }).click().catch(() => {});
  for (const r of ["", "kategori/semua", "produk/niacinamide-serum"]) { await page.goto(base + "#/" + r); await page.waitForTimeout(60); await overflow(`halimun ${r || "home"}`); }
  await page.getByRole("button", { name: "Sambung" }).click().catch(() => {});
  await signIn(page);
  for (const r of authRoutes) { await page.goto(base + "#/" + r); await page.waitForTimeout(60); await overflow(r); }
  await page.goto(base + "#/kategori/kabel");
  for (const n of ["Kabel USB-C ke USB-C 100W Braided", "Kabel HDMI 2.1 8K · 2 m", "Kabel DisplayPort 1.4 · 2 m"]) await page.getByRole("checkbox", { name: `Bandingkan ${n}` }).click();
  await page.goto(base + "#/bandingkan"); await page.waitForTimeout(60); await overflow("bandingkan");
  await staffIn(page, "Andi S.");
  for (const r of adminRoutes) { await page.goto(base + "#/" + r); await page.waitForTimeout(60); await overflow(r); }
  await ctx.close();
}

// Keyboard: focus trap, Escape, focus return (WCAG 2.1.2, 2.4.3)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await staffIn(page, "Dewi O.");
  await page.goto(base + "#/admin/orders/ORD-261020-0009");
  const opener = page.getByRole("button", { name: /Tampilkan kontak/ });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dlg = page.getByRole("dialog");
  check("dialog opens with focus inside", await dlg.evaluate((d) => d.contains(document.activeElement)));
  let inside = true;
  for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); inside &&= await dlg.evaluate((d) => d.contains(document.activeElement)); }
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Shift+Tab"); inside &&= await dlg.evaluate((d) => d.contains(document.activeElement)); }
  check("Tab / Shift+Tab stay inside dialog", inside);
  await page.keyboard.press("Escape");
  check("Escape closes dialog", (await page.getByRole("dialog").count()) === 0);
  check("focus returns to opener", await opener.evaluate((b) => b === document.activeElement));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  check("axe admin order (after dialog)", r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length === 0);
  // Storefront keyboard-only purchase: select variant and add to cart with keyboard
  await page.goto(base + "#/produk/kabel-usb-c-100w-braided");
  await page.getByRole("button", { name: /3 m · Hitam/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /\+ Keranjang/ }).focus();
  await page.keyboard.press("Enter");
  check("keyboard add to cart", await page.getByText(/Ditambahkan: 1× Kabel USB-C ke USB-C 100W Braided \(3 m · Hitam\)/).isVisible());
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
