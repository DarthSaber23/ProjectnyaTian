import { HttpException } from "@nestjs/common";
import { ArticleService } from "../content/article.service";
import { ContentEvents } from "../content/content-events";
import type { ArticleTextInput } from "../content/content.types";
import type { MediaActor } from "../media/media.types";
import type { PrismaService } from "../prisma.service";
import { fakeContentDb, type ContentSeed } from "./fake-content-db";
import { fakeStorage } from "./fake-storage";

/** Shared set-up for the content tests: fake database and storage, a settable clock, change counter. */

export const SEO: MediaActor = { id: "U-05", label: "Sinta P. (SEO)" };
export const OWNER: MediaActor = { id: "U-01", label: "Andi S. (Owner)" };
export const NOW = "2026-10-30T10:00:00+07:00";

export const META = "Panduan memilih kabel USB-C untuk laptop dan ponsel, dari daya sampai panjang kabel.";

export function idText(over: Partial<ArticleTextInput> = {}): ArticleTextInput {
  return {
    slug: "cara-memilih-kabel", title: "Cara memilih kabel USB-C", seoTitle: null, metaDescription: META,
    summary: "Daya, panjang dan kecepatan data.", body: "## Daya\n\nLaptop butuh 65W ke atas.", noindex: false, canonicalUrl: null, ...over,
  };
}

export function enText(over: Partial<ArticleTextInput> = {}): ArticleTextInput {
  return idText({ slug: "choosing-a-usb-c-cable", title: "Choosing a USB-C cable", summary: "Power, length and data speed.", body: "## Power\n\nLaptops need 65W or more.", ...over });
}

export function contentHarness(seed: ContentSeed = {}) {
  const db = fakeContentDb({
    products: [{ id: "B01", storeId: "sambung", name: "Kabel USB-C", slug: "kabel-usb-c" }, { id: "B02", storeId: "sambung", name: "Adaptor", slug: "adaptor" }, { id: "A01", storeId: "halimun", name: "Krim", slug: "krim" }],
    staff: [{ id: "U-05", name: "Sinta P.", role: "seo" }, { id: "U-01", name: "Andi S.", role: "owner" }],
    ...seed,
  });
  const storage = fakeStorage();
  const events = new ContentEvents();
  let changes = 0;
  events.subscribe(() => { changes += 1; });
  const service = new ArticleService(db.prisma as unknown as PrismaService, storage, events);
  const clock = { now: NOW };
  service.now = () => clock.now;
  return { ...db, storage, events, service, clock, changes: () => changes };
}

/** "ok", or "status CODE message". */
export async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const body = error.getResponse() as { code: string; message: string };
    return `${error.getStatus()} ${body.code} ${body.message}`;
  }
}
