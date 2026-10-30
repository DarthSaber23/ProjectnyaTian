import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { plainText, renderMarkdown } from "./markdown";

const vectors = JSON.parse(readFileSync(resolve(__dirname, "markdown.vectors.json"), "utf8")) as { name: string; input: string; html: string }[];

describe("renderMarkdown (shared vectors with web/src/domain/markdown.ts)", () => {
  it.each(vectors.map((v) => [v.name, v] as const))("%s", (_name, v) => {
    expect(renderMarkdown(v.input)).toBe(v.html);
  });

  it("never emits a tag outside the allowlist, whatever the input", () => {
    const hostile = vectors.map((v) => v.input).join("\n\n") + "\n\n<iframe src=x></iframe><svg onload=alert(1)>";
    const tags = [...renderMarkdown(hostile).matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]);
    expect(new Set(tags)).toEqual(new Set(tags.filter((t) => ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "figure", "img"].includes(t))));
  });
});

describe("plainText", () => {
  it("strips Markdown marks and keeps the words", () => {
    expect(plainText("## Daya\n\n- **satu** [tautan](/produk/a)\n\n![alt](/media/articles/a/0123456789abcdef-960.webp)")).toBe("Daya satu tautan");
  });
});
