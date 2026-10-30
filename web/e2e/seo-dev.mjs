// Blog and SEO checks against a deployed origin (dev). Run: BASE=http://<host> STAFF_TOTP_SECRET=… node e2e/seo-dev.mjs
// Uses the seeded demo staff (shared demo password, server TOTP secret) and the demo SEO account from content:seed.
// Creates two test articles in the deployment's store, checks crawler HTML, redirects, schedule, sitemap, the storefront
// and admin, then deletes them again. Prints N/N and exits non-zero on any failure. PUBLIC_BASE defaults to BASE.
import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const BASE = (process.env.BASE ?? "").replace(/\/$/, "");
const PUBLIC = (process.env.PUBLIC_BASE ?? BASE).replace(/\/$/, "");
const SECRET = process.env.STAFF_TOTP_SECRET ?? "";
const PASSWORD = "demo-staff-2026";
const STORE = process.env.STORE ?? "sambung";
if (!BASE || !SECRET) {
  console.error("Set BASE and STAFF_TOTP_SECRET.");
  process.exit(2);
}
const PRODUCT_SLUG = "kabel-usb-c-100w-braided";
const CATEGORY_SLUG = "kabel";
const RUN = Date.now().toString(36);
const SLUG = `uji-seo-${RUN}`;
const RENAMED = `uji-seo-baru-${RUN}`;
const LATER = `uji-seo-jadwal-${RUN}`;
const META = "Artikel uji otomatis untuk memeriksa tag SEO, pengalihan slug, dan halaman blog di server dev.";

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

/** The page as a crawler sees it: no JavaScript, no redirect following. */
async function raw(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers: { "User-Agent": "seo-dev-check" } });
  return { status: res.status, headers: res.headers, html: await res.text() };
}

function headTags(html, path, { title, text, jsonld }) {
  const problems = [];
  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if (!titleTag.includes(title)) problems.push(`title "${titleTag}"`);
  if (!/<meta name="description" content="[^"]{20,}">/.test(html)) problems.push("description");
  if (!html.includes(`<link rel="canonical" href="${PUBLIC}${path}">`)) problems.push(`canonical ${html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? "missing"}`);
  if (!html.includes('<meta property="og:title"')) problems.push("og:title");
  if (!html.includes('<script type="application/ld+json">') || !html.includes(`"@type":"${jsonld}"`)) problems.push(`JSON-LD ${jsonld}`);
  const ssr = html.split('<div id="ssr">')[1] ?? "";
  if (!ssr.includes(text)) problems.push(`#ssr text "${text}"`);
  return problems;
}

/** Layout shift after load. `plain`: serve the page as the bare index.html (the shell before item 2) for a same-run baseline. */
async function cls(page, url, { plain = false } = {}) {
  await page.unroute(url).catch(() => undefined);
  if (plain) {
    const html = await (await fetch(`${BASE}/`)).text();
    await page.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  }
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  return page.evaluate(() => new Promise((resolve) => {
    let total = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; })
      .observe({ type: "layout-shift", buffered: true });
    setTimeout(() => resolve(total), 300);
  }));
}

async function axe(page) {
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  assert(bad.length === 0, bad.map((v) => v.id).join(","));
}

const text = (slug, title) => ({ slug, title, seoTitle: null, metaDescription: META, summary: "Artikel uji otomatis.", body: `## Uji\n\nKalimat penanda ${RUN} untuk pemeriksaan.`, noindex: false, canonicalUrl: null });

const browser = await chromium.launch();
const created = [];
let seo;
try {
  seo = await staffContext(browser, "sinta@toko.example");

  await check("SEO staff signs in through the UI and lands on Blog", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await uiSignIn(p, "sinta@toko.example");
    await p.getByRole("heading", { name: "Blog", exact: true }).waitFor({ timeout: 10_000 });
    assert(p.url().endsWith("/admin/blog") || p.url().includes("/admin/blog?"), `landed on ${p.url()}`);
    const menu = await p.getByRole("navigation", { name: "Admin" }).getByRole("link").allTextContents();
    assert(JSON.stringify(menu) === JSON.stringify(["Produk", "Blog", "SEO"]), `menu ${menu.join(",")}`);
    await ctx.close();
  });

  let article;
  await check("SEO creates, links a product and publishes an article", async () => {
    let res = await seo.request.post("/v1/admin/articles", { data: { store: STORE, text: text(SLUG, `Artikel uji ${RUN}`) } });
    assert(res.ok(), `create ${res.status()} ${await res.text()}`);
    article = await res.json();
    created.push(article.id);
    res = await seo.request.put(`/v1/admin/articles/${article.id}`, { data: { version: article.version, texts: { id: article.texts.id }, tags: [], productIds: ["B01"] } });
    assert(res.ok(), `save ${res.status()} ${await res.text()}`);
    article = await res.json();
    res = await seo.request.post(`/v1/admin/articles/${article.id}/publish`, { data: { version: article.version, publishAt: null } });
    assert(res.ok(), `publish ${res.status()} ${await res.text()}`);
    article = await res.json();
    assert(article.live, "not live");
    return article.id;
  });

  await check("crawler HTML of the article has title, description, canonical, og, JSON-LD and text", async () => {
    const page = await raw(`/blog/${SLUG}`);
    assert(page.status === 200, `status ${page.status}`);
    const problems = headTags(page.html, `/blog/${SLUG}`, { title: `Artikel uji ${RUN}`, text: `Kalimat penanda ${RUN}`, jsonld: "BlogPosting" });
    assert(problems.length === 0, problems.join("; "));
  });

  await check("crawler HTML of a product and a category", async () => {
    const product = await raw(`/produk/${PRODUCT_SLUG}`);
    const category = await raw(`/kategori/${CATEGORY_SLUG}`);
    assert(product.status === 200 && category.status === 200, `status ${product.status}/${category.status}`);
    const problems = [
      ...headTags(product.html, `/produk/${PRODUCT_SLUG}`, { title: "Kabel USB-C ke USB-C 100W Braided", text: "Kabel USB-C ke USB-C 100W Braided", jsonld: "Product" }).map((p) => `product ${p}`),
      ...headTags(category.html, `/kategori/${CATEGORY_SLUG}`, { title: "Kabel", text: "Kabel", jsonld: "CollectionPage" }).map((p) => `category ${p}`),
    ];
    assert(problems.length === 0, problems.join("; "));
  });

  await check("renaming the slug answers 301 from the old URL", async () => {
    const res = await seo.request.put(`/v1/admin/articles/${article.id}`, { data: { version: article.version, texts: { id: { ...article.texts.id, slug: RENAMED } }, tags: [], productIds: ["B01"] } });
    assert(res.ok(), `save ${res.status()} ${await res.text()}`);
    article = await res.json();
    const old = await raw(`/blog/${SLUG}`);
    assert(old.status === 301 && old.headers.get("location") === `/blog/${RENAMED}`, `${old.status} → ${old.headers.get("location")}`);
    assert((await raw(`/blog/${RENAMED}`)).status === 200, "new slug not 200");
  });

  await check("a scheduled article stays 404 until its time", async () => {
    let res = await seo.request.post("/v1/admin/articles", { data: { store: STORE, text: text(LATER, `Artikel terjadwal ${RUN}`) } });
    assert(res.ok(), `create ${res.status()}`);
    const later = await res.json();
    created.push(later.id);
    const at = new Date(Date.now() + 2 * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 16) + ":00+07:00";
    res = await seo.request.post(`/v1/admin/articles/${later.id}/publish`, { data: { version: later.version, publishAt: at } });
    assert(res.ok(), `schedule ${res.status()} ${await res.text()}`);
    const page = await raw(`/blog/${LATER}`);
    const api = await fetch(`${BASE}/v1/articles/${LATER}?lang=id`);
    assert(page.status === 404 && api.status === 404, `page ${page.status}, api ${api.status}`);
  });

  await check("sitemap.xml lists the article and robots.txt names the sitemap", async () => {
    const sitemap = await raw("/sitemap.xml");
    const robots = await raw("/robots.txt");
    assert(sitemap.status === 200 && sitemap.headers.get("content-type")?.includes("xml"), `sitemap ${sitemap.status} ${sitemap.headers.get("content-type")}`);
    assert(sitemap.html.includes(`<loc>${PUBLIC}/blog/${RENAMED}</loc>`), `article missing from sitemap (${(sitemap.html.match(/\/blog\/[^<]+/g) ?? []).join(" ")})`);
    assert(!sitemap.html.includes(LATER), "scheduled article in sitemap");
    assert(sitemap.html.includes(`<loc>${PUBLIC}/produk/${PRODUCT_SLUG}</loc>`), "product missing from sitemap");
    assert(robots.status === 200 && robots.html.includes(`Sitemap: ${PUBLIC}/sitemap.xml`), "robots has no sitemap line");
    assert(robots.html.includes("Disallow: /admin"), "robots does not keep /admin out");
  });

  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await shopper.newPage();

  await check("shoppers see the article once, without the #ssr copy", async () => {
    await page.goto(`${BASE}/blog/${RENAMED}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: `Artikel uji ${RUN}` }).waitFor({ timeout: 15_000 });
    assert(!(await page.locator("#ssr").isVisible().catch(() => false)), "#ssr visible");
    assert((await page.getByText(`Kalimat penanda ${RUN}`).filter({ visible: true }).count()) === 1, "body text shown twice or not at all");
    await page.getByRole("heading", { name: "Produk di artikel ini" }).waitFor({ timeout: 10_000 });
  });

  await check("axe: 0 serious/critical on the article and /blog", async () => {
    await axe(page);
    await page.goto(`${BASE}/blog`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Blog" }).waitFor({ timeout: 10_000 });
    await axe(page);
  });

  await check("product page shows 'Artikel terkait' with the test article, and passes axe", async () => {
    await page.goto(`${BASE}/produk/${PRODUCT_SLUG}`, { waitUntil: "networkidle" });
    const section = page.getByRole("region", { name: "Artikel terkait" });
    await section.waitFor({ timeout: 15_000 });
    await section.getByRole("link", { name: new RegExp(`Artikel uji ${RUN}`) }).waitFor({ timeout: 5_000 });
    await axe(page);
  });

  await check("footer links to the blog and home shows 'Dari blog'", async () => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Dari blog" }).waitFor({ timeout: 15_000 });
    assert((await page.locator('footer a[href="/blog"]').count()) === 1, "no footer Blog link");
  });

  await check("CLS: blog pages have no content jump; the product page is no worse than the bare index.html", async () => {
    // Web-font swap (Google Fonts) adds a variable 0.00-0.05 on every page; the blog pages reserve a screen of height, so
    // anything above that would be a content jump. The product page keeps the approved layout's loading jump (owner decision).
    const blog = await cls(page, `${BASE}/blog`);
    const article = await cls(page, `${BASE}/blog/${RENAMED}`);
    // Both shells swing between about 0.107 and 0.16 run to run (loading and font timing), so compare the best of three.
    const best = async (plain) => Math.min(...[await cls(page, `${BASE}/produk/${PRODUCT_SLUG}`, { plain }), await cls(page, `${BASE}/produk/${PRODUCT_SLUG}`, { plain }), await cls(page, `${BASE}/produk/${PRODUCT_SLUG}`, { plain })]);
    const product = await best(false);
    const baseline = await best(true);
    const detail = `blog ${blog.toFixed(3)}, article ${article.toFixed(3)}, product ${product.toFixed(3)} vs bare ${baseline.toFixed(3)}`;
    assert(blog < 0.05 && article < 0.05 && product <= baseline + 0.01, detail);
    return detail;
  });

  await check("the editor passes axe", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await uiSignIn(p, "sinta@toko.example");
    await p.goto(`${BASE}/admin/blog/${article.id}`);
    await p.getByLabel("Judul", { exact: true }).waitFor({ timeout: 10_000 });
    await p.screenshot({ path: "e2e/shot-admin-blog.png", fullPage: true });
    try { await axe(p); } finally { await ctx.close(); }
  });

  await shopper.close();

  for (const [email, role] of [["dewi@toko.example", "operations"], ["rina.m@toko.example", "marketing"]]) {
    await check(`${role} gets 403 from the article and SEO API`, async () => {
      const ctx = await staffContext(browser, email);
      const statuses = [
        (await ctx.request.get(`/v1/admin/articles?store=${STORE}`)).status(),
        (await ctx.request.get(`/v1/admin/seo?store=${STORE}&kind=product`)).status(),
      ];
      await ctx.close();
      assert(statuses.every((s) => s === 403), statuses.join(","));
    });
  }

  await check("SEO gets 403 on orders, customers, promotions and audit", async () => {
    const statuses = await Promise.all(["/v1/admin/orders", "/v1/admin/customers", "/v1/admin/promotions/HEMAT10", "/v1/admin/audit-log"].map(async (p) => `${p}=${(await seo.request.get(p)).status()}`));
    assert(statuses.every((s) => s.endsWith("=403")), statuses.join(" "));
  });
} finally {
  if (seo) {
    for (const id of created) {
      const res = await seo.request.get(`/v1/admin/articles/${id}`).catch(() => null);
      const view = res?.ok() ? await res.json() : null;
      if (view?.status === "published") await seo.request.post(`/v1/admin/articles/${id}/unpublish`, { data: { version: view.version } }).catch(() => undefined);
      await seo.request.delete(`/v1/admin/articles/${id}`).catch(() => undefined);
    }
    await seo.close();
  }
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
