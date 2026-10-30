import { existsSync, readFileSync } from "fs";
import path from "path";
import { readSamples, loadSample } from "../../media/cli/common";
import type { MediaActor } from "../../media/media.types";
import { configureSharp } from "../../media/process";
import { PrismaService } from "../../prisma.service";
import { ObjectStorage, S3ObjectStorage } from "../../storage.service";
import type { BrandId } from "../../domain/types";
import { ArticleService } from "../article.service";
import { ContentEvents } from "../content-events";
import type { ArticleTextInput, Lang } from "../content.types";
import { plainText } from "../markdown";
import { checkLengths } from "../rules";

/** One demo article in server/seed/content/articles.json. `cover` takes the item 1 sample photo of that product. */
export interface ContentSeedEntry {
  store: BrandId;
  tags: string[];
  productIds: string[];
  cover: { productId: string; alt: string } | null;
  texts: { id: ArticleTextInput; en?: ArticleTextInput };
}

export interface ContentCliDeps {
  prisma: PrismaService;
  storage: ObjectStorage;
  articles: ArticleService;
  articlesFile: string;
  mediaDir: string;
}

/** The demo SEO account (fixtures U-05); demo articles are written in its name. */
export const DEMO_SEO = { id: "U-05", name: "Sinta P.", email: "sinta@toko.example", role: "seo" } as const;

const MAX_PRODUCTS = 6;

export function readArticles(file: string): ContentSeedEntry[] {
  return JSON.parse(readFileSync(file, "utf8")) as ContentSeedEntry[];
}

/** The largest WebP copy of a product's sample photo, or null when the product has none. */
export function coverFile(mediaDir: string, productId: string): { buffer: Buffer; originalname: string; size: number } | null {
  const entry = readSamples(mediaDir).find((s) => s.productId === productId);
  if (!entry || entry.files.some((name) => !existsSync(path.join(mediaDir, name)))) return null;
  const largest = loadSample(entry, mediaDir).copies.at(-1)!;
  return { buffer: largest.buffer, originalname: largest.name, size: largest.buffer.length };
}

type ProductLookup = { product: { findUnique(args: { where: { id: string } }): Promise<{ id: string; storeId: string } | null> } };

/** Every problem, one line each naming `store/slug`. Empty means every entry can be published as it is. */
export async function validateArticles(entries: ContentSeedEntry[], deps: { prisma: ProductLookup; mediaDir: string }): Promise<string[]> {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = `${entry.store}/${entry.texts?.id?.slug ?? "?"}`;
    const say = (text: string) => problems.push(`${name}: ${text}`);
    if (!entry.texts?.id) { say("versi Bahasa Indonesia wajib ada"); continue; }
    for (const [lang, text] of Object.entries(entry.texts) as [Lang, ArticleTextInput | undefined][]) {
      if (!text) continue;
      for (const problem of checkLengths(text, true)) problems.push(`${name} (${lang}): ${problem}`);
      if (text.body && !plainText(text.body).trim()) problems.push(`${name} (${lang}): isi kosong setelah dirender`);
      const key = `${entry.store}/${lang}/${text.slug}`;
      if (seen.has(key)) problems.push(`${name} (${lang}): slug dipakai dua kali`);
      seen.add(key);
    }
    if (entry.productIds.length > MAX_PRODUCTS) say(`maksimal ${MAX_PRODUCTS} produk`);
    else {
      for (const id of new Set(entry.productIds)) {
        const product = await deps.prisma.product.findUnique({ where: { id } });
        if (!product || product.storeId !== entry.store) say(`produk ${id} tidak ada di toko ini`);
      }
    }
    if (entry.cover) {
      if (!entry.cover.alt?.trim()) say("teks alternatif sampul wajib diisi");
      else if (!coverFile(deps.mediaDir, entry.cover.productId)) say(`tidak ada foto contoh untuk ${entry.cover.productId}`);
    }
  }
  return problems;
}

/** Audit shows the operator; the article's author is the demo SEO account. */
export function seedActor(operator: string | undefined, fallback: string): MediaActor {
  return { id: DEMO_SEO.id, label: `CLI: ${operator ?? fallback}` };
}

/** The commands run in their own Node process; the operator restarts `api` afterwards so cached pages refresh. */
export function buildContentDeps(): ContentCliDeps & { close(): Promise<void> } {
  configureSharp();
  const prisma = new PrismaService();
  const storage = new S3ObjectStorage();
  const articles = new ArticleService(prisma, storage, new ContentEvents());
  return {
    prisma, storage, articles,
    articlesFile: path.resolve(process.cwd(), "seed/content/articles.json"),
    mediaDir: path.resolve(process.cwd(), "seed/media"),
    close: () => prisma.$disconnect(),
  };
}
