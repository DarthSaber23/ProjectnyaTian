import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");

describe("index.html shell", () => {
  it("marks <html> as js before any stylesheet and hides the server text (#ssr) once scripts run", () => {
    const script = '<script>document.documentElement.classList.add("js")</script>';
    expect(html).toContain(script);
    expect(html.indexOf(script)).toBeLessThan(html.indexOf("<link"));
    expect(html).toContain("<style>.js #ssr{display:none}</style>");
  });

  it("keeps an empty root and a title the renderer can replace", () => {
    expect(html).toContain('<div id="root"></div>');
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('<html lang="id">');
  });
});
