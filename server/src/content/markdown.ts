/**
 * The article body format (spec section 4): a small Markdown subset turned into HTML through an allowlist.
 * Raw HTML is never passed through. A copy lives in web/src/domain/markdown.ts; both run the same vectors.
 */

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const HEADING = /^(#{2,3}) (.+)$/;
const BULLET = /^[-*] (.+)$/;
const NUMBERED = /^\d+\. (.+)$/;
const IMAGE_LINE = /^!\[([^[\]]*)\]\(([^()\s]+)\)$/;
const IMAGE_SRC = /^\/media\/articles\/[A-Za-z0-9_-]+\/[0-9a-f]{16}-[0-9]{3,4}\.webp$/;
// Link text has no brackets; the URL is https://, http:// or a site path (not //host), with no quotes, spaces or angle brackets.
const LINK = /(?<!!)\[([^[\]]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s()"'<>\\]*)\)/g;

function emphasis(escaped: string): string {
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>");
}

function inline(raw: string): string {
  let out = "";
  let last = 0;
  for (const match of raw.matchAll(LINK)) {
    const [whole, text, url] = match;
    out += emphasis(escapeHtml(raw.slice(last, match.index)));
    const external = /^https?:\/\//.test(url!) ? ' rel="noopener noreferrer"' : "";
    out += `<a href="${escapeHtml(url!)}"${external}>${emphasis(escapeHtml(text!))}</a>`;
    last = match.index! + whole.length;
  }
  return out + emphasis(escapeHtml(raw.slice(last)));
}

export function renderMarkdown(source: string): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
    if (list) blocks.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    paragraph = [];
    list = null;
  };
  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    const heading = HEADING.exec(line);
    const image = IMAGE_LINE.exec(line);
    const item = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (heading) {
      flush();
      const tag = heading[1]!.length === 2 ? "h2" : "h3";
      blocks.push(`<${tag}>${inline(heading[2]!)}</${tag}>`);
    } else if (image && IMAGE_SRC.test(image[2]!)) {
      flush();
      blocks.push(`<figure><img src="${escapeHtml(image[2]!)}" alt="${escapeHtml(image[1]!)}" loading="lazy" decoding="async"></figure>`);
    } else if (item) {
      const tag = BULLET.test(line) ? "ul" : "ol";
      if (paragraph.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(item[1]!);
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks.join("\n");
}

/** The words of the body without Markdown marks (reading time, server-filled page text). */
export function plainText(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !IMAGE_LINE.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^(?:[-*]|\d+\.)\s+/, "").replace(LINK, "$1").replace(/\*/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
