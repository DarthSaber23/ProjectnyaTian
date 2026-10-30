const PRIVATE = ["/admin", "/akun", "/keranjang", "/checkout", "/pembayaran", "/masuk", "/cari", "/bandingkan", "/v1/"];

/** robots.txt: everything public except the private and thin pages, and the sitemap's absolute URL. */
export function renderRobots(baseUrl: string): string {
  return ["User-agent: *", "Allow: /", ...PRIVATE.map((p) => `Disallow: ${p}`), "", `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n");
}
