import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { plainText, renderMarkdown } from "./markdown";

const vectors = JSON.parse(readFileSync(resolve(__dirname, "markdown.vectors.json"), "utf8")) as { name: string; input: string; html: string }[];
const serverCopy = resolve(__dirname, "../../../server/src/content/markdown.vectors.json");

describe("renderMarkdown (web copy, same vectors as the server)", () => {
  it.each(vectors.map((v) => [v.name, v] as const))("%s", (_name, v) => {
    expect(renderMarkdown(v.input)).toBe(v.html);
  });

  it.runIf(existsSync(serverCopy))("the vector file is identical to the server's", () => {
    expect(readFileSync(resolve(__dirname, "markdown.vectors.json"), "utf8")).toBe(readFileSync(serverCopy, "utf8"));
  });

  it("plainText strips the marks", () => {
    expect(plainText("## Daya\n\n- **satu** [tautan](/produk/a)")).toBe("Daya satu tautan");
  });
});
