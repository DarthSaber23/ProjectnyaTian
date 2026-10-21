// Admin E2E + accessibility scan (M7 batch 3). Run after `npm run build:preview`.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const base = pathToFileURL(resolve("dist-preview/index.html")).href;
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const axeScan = async (page, label) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  check(`axe ${label}`, bad.length === 0, bad.map((v) => `${v.id}(${v.nodes.length})`).join(", "));
};
const login = async (page, who) => {
  await page.goto(base + "#/admin/login");
  await page.getByRole("button", { name: new RegExp(who) }).click();
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
};
const logout = async (page) => page.getByRole("button", { name: "Keluar" }).click();

for (const vp of [{ w: 1440, h: 900, n: "desktop" }, { w: 390, h: 844, n: "mobile" }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
  const scan = vp.n === "desktop" ? axeScan : async () => {};

  await page.goto(base + "#/admin");
  check(`${vp.n} redirect to admin login`, await page.getByRole("heading", { name: /Admin/ }).isVisible());
  await scan(page, "admin login");
  await page.getByLabel("Email").fill("dewi@toko.example");
  await page.getByLabel("Kata sandi").fill("demo-staff-2026");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  check(`${vp.n} TOTP required`, await page.getByText("Masukkan 6 digit kode autentikator.").isVisible());
  await page.getByLabel(/Kode autentikator/).fill("123456");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.getByRole("heading", { name: "Dasbor" }).waitFor();
  for (const v of ["Rp2.097.000", "Rp262.125", "0,65%", "88,9%", "Rp237.000"]) check(`${vp.n} dashboard ${v}`, (await page.getByText(v, { exact: true }).count()) > 0);
  check(`${vp.n} ops has no audit menu`, (await page.getByRole("link", { name: "Log audit" }).count()) === 0);
  await scan(page, "dashboard");

  await page.getByRole("link", { name: "Pesanan", exact: true }).click();
  await page.getByRole("tab", { name: /Perlu diproses 2/ }).click();
  await page.getByRole("link", { name: "ORD-261020-0009" }).click();
  check(`${vp.n} contact masked for ops`, await page.getByText("c***@example.com").isVisible());
  await page.getByRole("button", { name: "Proses pesanan" }).click();
  await page.getByRole("button", { name: "Kirim…" }).click();
  await page.getByRole("button", { name: "Tandai Dikirim" }).click();
  check(`${vp.n} resi required`, await page.getByText("Nomor resi wajib diisi.").isVisible());
  await page.getByLabel("Nomor resi *").fill("abc");
  await page.getByRole("button", { name: "Tandai Dikirim" }).click();
  check(`${vp.n} resi format`, await page.getByText(/Format resi tidak valid/).isVisible());
  await scan(page, "ship dialog");
  await page.getByRole("button", { name: "Panel uji: isi resi contoh" }).click();
  await page.getByRole("button", { name: "Tandai Dikirim" }).click();
  check(`${vp.n} shipped with resi`, await page.getByText("SIM-KA-88213010", { exact: true }).isVisible());
  check(`${vp.n} history 10:20 + 10:22`, await page.getByText(/20 Okt 2026, 10:20 WIB · Dewi O\. \(Operasional\)/).isVisible() && await page.getByText(/20 Okt 2026, 10:22 WIB/).first().isVisible());
  await page.getByRole("button", { name: /Tampilkan kontak/ }).click();
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  check(`${vp.n} reveal needs reason`, await page.getByText("Pilih alasan sebelum menampilkan kontak.").isVisible());
  await page.getByLabel("Konfirmasi pengiriman pesanan").check();
  await scan(page, "reveal dialog");
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  check(`${vp.n} contact revealed`, await page.getByText("citra@example.com").isVisible());
  await page.getByRole("button", { name: /simulasikan 60 detik/ }).click();
  check(`${vp.n} contact re-masked`, await page.getByText("c***@example.com").isVisible());

  await page.goto(base.replace(/#.*$/, "") + "#/admin/orders/ORD-261019-0007");
  // in-memory session survives hash navigation only within the same page load; re-login if needed
  if (await page.getByRole("heading", { name: /Admin/ }).isVisible().catch(() => false)) await login(page, "Dewi O.");
  await page.getByRole("link", { name: "Pesanan", exact: true }).click();
  await page.getByRole("link", { name: "ORD-261019-0007" }).click();
  await page.getByRole("button", { name: "Catat refund…" }).click();
  check(`${vp.n} ops cannot refund`, await page.getByText(/Refund hanya oleh Owner\/Admin/).isVisible());
  await logout(page);

  await login(page, "Andi S.");
  await page.getByRole("link", { name: "Pesanan", exact: true }).click();
  await page.getByRole("link", { name: "ORD-261019-0007" }).click();
  check(`${vp.n} owner sees full contact`, await page.getByText("budi@example.com").isVisible());
  await page.getByRole("button", { name: "Catat refund…" }).click();
  await page.getByRole("button", { name: "Jumlah lain" }).click();
  await page.getByLabel(/Jumlah \(Rupiah/).fill("300000");
  await page.getByRole("button", { name: "Pelanggan membatalkan" }).click();
  await page.getByRole("button", { name: /Catat refund Rp300\.000/ }).click();
  check(`${vp.n} refund over limit`, await page.getByText(/melebihi sisa yang bisa direfund \(Rp217\.000\)/).isVisible());
  await page.getByRole("button", { name: /Sisa penuh Rp217\.000/ }).click();
  await scan(page, "refund dialog");
  await page.getByRole("button", { name: /Catat refund Rp217\.000/ }).click();
  check(`${vp.n} refunded + cancelled`, await page.getByText("Direfund", { exact: true }).isVisible() && await page.getByText("Dibatalkan", { exact: true }).first().isVisible());
  await page.getByRole("link", { name: "Dasbor" }).click();
  check(`${vp.n} D12 net after refund Rp1.880.000`, (await page.getByText("Rp1.880.000", { exact: true }).count()) > 0);
  await page.getByRole("link", { name: "Log audit" }).click();
  for (const c of ["REFUND_RECORDED", "CONTACT_REVEAL", "ORDER_SHIPPED", "ORDER_STATUS"]) check(`${vp.n} audit ${c}`, (await page.getByText(c, { exact: true }).count()) > 0);
  await scan(page, "audit log");
  await page.getByRole("link", { name: "Promosi" }).click();
  check(`${vp.n} P06-1 FS wins 21–22`, await page.getByText("Rp299.250 · FS-WEEKEND").isVisible() && await page.getByText("Rp339.150 · CHARGER15").isVisible());
  await page.getByRole("button", { name: /−30%/ }).click();
  check(`${vp.n} P06-2 warning`, await page.getByText(/CHARGER15 lebih murah dari flash sale/).isVisible());
  await page.getByRole("button", { name: "Jadwalkan" }).click();
  check(`${vp.n} P06-3 review required`, await page.getByText(/Centang konfirmasi/).isVisible());
  await page.getByRole("button", { name: "20 Okt 00:00" }).click();
  await page.getByLabel(/sudah meninjau/).check();
  await page.getByRole("button", { name: "Jadwalkan" }).click();
  check(`${vp.n} P06-3 past start rejected`, await page.getByText(/Tanggal mulai sudah lewat/).first().isVisible());
  await page.getByRole("button", { name: "21 Okt 00:00" }).click();
  await page.getByLabel(/sudah meninjau/).check();
  await page.getByRole("button", { name: "Jadwalkan" }).click();
  check(`${vp.n} scheduled`, await page.getByText("Terjadwal", { exact: true }).isVisible());
  await scan(page, "promotions");
  await logout(page);

  await login(page, "Akun CS demo");
  check(`${vp.n} CS lands on orders`, await page.getByRole("heading", { name: "Pesanan", exact: true }).isVisible());
  check(`${vp.n} CS menu only orders`, (await page.getByRole("link", { name: "Dasbor" }).count()) === 0 && (await page.getByRole("link", { name: "Promosi" }).count()) === 0);
  await logout(page);
  await login(page, "Rina M.");
  check(`${vp.n} marketing has no orders menu`, (await page.getByRole("link", { name: "Pesanan", exact: true }).count()) === 0);
  check(`${vp.n} no runtime errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  if (vp.n === "desktop") { await page.getByRole("link", { name: "Promosi" }).click(); }
  await ctx.close();
}

// screenshots
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await login(p, "Dewi O.");
await p.getByRole("heading", { name: "Dasbor" }).waitFor();
await p.screenshot({ path: "e2e/shot-admin-dashboard.png", fullPage: true });
await p.getByRole("link", { name: "Pesanan", exact: true }).click();
await p.getByRole("link", { name: "ORD-261020-0009" }).click();
await p.getByRole("button", { name: /Tampilkan kontak/ }).click();
await p.screenshot({ path: "e2e/shot-admin-reveal.png", fullPage: true });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
