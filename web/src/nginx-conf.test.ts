import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

/** Static checks of the nginx template; `nginx -t` on the real template runs in the dev deploy check. */

const conf = readFileSync(resolve(__dirname, "../nginx.conf"), "utf8");
const dockerfile = readFileSync(resolve(__dirname, "../Dockerfile"), "utf8");
const compose = readFileSync(resolve(__dirname, "../../docker-compose.yml"), "utf8");
const block = (opening: string) => {
  const start = conf.indexOf(opening);
  expect(start).toBeGreaterThanOrEqual(0);
  return conf.slice(start, conf.indexOf("\n  }", start));
};
const count = (text: string, needle: string) => text.split(needle).length - 1;

const MEDIA = 'location ~ "^/media/((products|articles)/[A-Za-z0-9_-]+/[0-9a-f]{16}-[0-9]{3,4}\\.webp)$"';
const HIDDEN = [
  "Server", "Cache-Control", "Set-Cookie", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id", "x-amz-server-side-encryption",
  "x-minio-deployment-id", "x-minio-error-code", "Strict-Transport-Security", "X-Xss-Protection", "Content-Security-Policy",
  // Seen on dev (29 Oct 2026): MinIO adds its own rate-limit headers and a second nosniff.
  "X-Ratelimit-Limit", "X-Ratelimit-Remaining", "X-Content-Type-Options",
];

describe("web/nginx.conf template", () => {
  it("serves /media from an allowlist: quoted regex, GET only, cookies stripped, query dropped", () => {
    expect(conf).toContain(MEDIA);
    const media = block(MEDIA);
    expect(media).toContain("limit_except GET { deny all; }");
    expect(media).toContain('proxy_set_header Cookie "";');
    expect(media).toContain('proxy_set_header Authorization "";');
    expect(media).toContain("rewrite ^/media/(.*)$ /${MINIO_BUCKET}/media/$1? break;");
    expect(media).toContain("proxy_pass ${MEDIA_UPSTREAM};");
    expect(media).toContain("proxy_next_upstream off;");
  });

  it("hides every MinIO header one per line and adds a single immutable Cache-Control", () => {
    const media = block(MEDIA);
    for (const name of HIDDEN) expect(media).toMatch(new RegExp(`^\\s*proxy_hide_header ${name};$`, "m"));
    expect(media).toMatch(/^\s*proxy_hide_header Vary;$/m);
    expect(count(media, 'add_header Cache-Control "public, max-age=31536000, immutable";')).toBe(1);
    expect(media).toContain('add_header X-Content-Type-Options "nosniff";');
  });

  it("answers every other /media/ path and every failure with the plain no-store 404", () => {
    expect(block(MEDIA)).toContain("error_page 400 401 403 404 405 500 502 503 504 = @media_404;");
    expect(block("location /media/ {")).toContain("return 404;");
    const notFound = block("location @media_404 {");
    expect(notFound).toContain("internal;");
    // An empty types map, or nginx labels a 404 for a .webp path as image/webp (seen on dev).
    expect(notFound).toContain("types { }");
    expect(notFound).toContain('add_header Cache-Control "no-store" always;');
    expect(notFound).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(notFound).toContain('return 404 "Not found";');
  });

  it("allows an 11m body only on the product photo and article cover/image upload paths and answers 413 as JSON", () => {
    expect(count(conf, "client_max_body_size")).toBe(2);
    for (const opening of ["location ~ ^/v1/admin/products/[^/]+/images$ {", "location ~ ^/v1/admin/articles/[^/]+/(cover|images)$ {"]) {
      const upload = block(opening);
      expect(upload, opening).toContain("client_max_body_size 11m;");
      expect(upload).toContain("limit_except POST { deny all; }");
      expect(upload).toContain("error_page 413 = @too_large;");
      expect(upload).toContain("proxy_pass http://api:8080;");
      expect(upload).toContain("proxy_http_version 1.1;");
      expect(upload).toContain("proxy_set_header Host $host;");
      expect(upload).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    }
    expect(block("location /v1/ {")).not.toContain("client_max_body_size");
    expect(block("location @too_large {")).toContain(
      `return 413 '{"error":{"code":"TOO_LARGE","message":"Ukuran file maksimal 10 MB.","details":[]}}';`,
    );
  });

  it("uses only the two template variables", () => {
    const tokens = new Set(conf.match(/\$\{[^}]+\}/g) ?? []);
    expect([...tokens].sort()).toEqual(["${MEDIA_UPSTREAM}", "${MINIO_BUCKET}"]);
  });

  it("Dockerfile copies the config to templates and compose gives web the env, extra_hosts and no env_file", () => {
    expect(dockerfile).toContain("COPY nginx.conf /etc/nginx/templates/default.conf.template");
    expect(dockerfile).not.toContain("conf.d");
    const web = compose.slice(compose.indexOf("\n  web:"));
    expect(web).toContain('"host.docker.internal:host-gateway"');
    expect(web).toContain('"MINIO_BUCKET=${MINIO_BUCKET:-tian-media}"');
    expect(web).toContain('"MEDIA_UPSTREAM=${MEDIA_UPSTREAM:-http://host.docker.internal:9000}"');
    expect(web).toContain('"NGINX_ENVSUBST_FILTER=^(MINIO_BUCKET|MEDIA_UPSTREAM)$"');
    expect(web).not.toContain("env_file");
    expect(compose.slice(0, compose.indexOf("\n  web:"))).toMatch(/mem_limit: 1536m/);
  });

  it("blog, product and category pages go to the API renderer and fall back to index.html on an API error", () => {
    for (const opening of ["location ~ ^/(blog|en/blog)(/|$) {", "location ~ ^/(produk|kategori)/ {"]) {
      const b = block(opening);
      expect(b).toContain("rewrite ^ /render break;");
      // The raw, still percent-encoded request line (with its query) goes to the renderer in a header.
      expect(b).toContain("proxy_set_header X-Render-Uri $request_uri;");
      expect(b).not.toContain("$uri");
      expect(b).toContain("proxy_pass http://api:8080;");
      expect(b).toContain("proxy_intercept_errors on;");
      expect(b).toContain("error_page 500 502 503 504 = @spa;");
    }
    const spa = block("location @spa {");
    expect(spa).toContain("try_files /index.html =404;");
    expect(spa).toContain('add_header Cache-Control "no-cache";');
  });

  it("sitemap.xml and robots.txt come from the API", () => {
    expect(block("location = /sitemap.xml {")).toContain("proxy_pass http://api:8080/sitemap.xml;");
    expect(block("location = /robots.txt {")).toContain("proxy_pass http://api:8080/robots.txt;");
  });

  it("the shell for the renderer answers only private networks and serves index.html", () => {
    const shell = block("location = /__shell.html {");
    for (const line of ["allow 127.0.0.1;", "allow 172.16.0.0/12;", "allow 10.0.0.0/8;", "allow 192.168.0.0/16;", "deny all;", "try_files /index.html =404;"]) expect(shell).toContain(line);
  });
});
