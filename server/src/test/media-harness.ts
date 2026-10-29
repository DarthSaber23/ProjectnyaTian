import { createHash } from "crypto";
import { HttpException, type ArgumentsHost } from "@nestjs/common";
import { vi } from "vitest";
import type { PrismaService } from "../prisma.service";
import { MediaService } from "../media/media.service";
import type { MediaActor } from "../media/media.types";
import { UploadExceptionFilter } from "../media/upload-exception.filter";
import { mediaKey } from "../media/public-image";
import { fakeMediaDb, type FakeImage } from "./fake-media-db";
import { fakeStorage, type FakeStorage } from "./fake-storage";
import { solidJpeg } from "./image-fixtures";

/** Shared set-up for the MediaService tests: fake database, fake storage, real image processing. */

export const STAFF: MediaActor = { id: "staff_mkt", label: "Maya (Marketing)" };
export const OTHER_STAFF: MediaActor = { id: "staff_adm", label: "Adi (Admin)" };
export const CLI: MediaActor = { id: "cli", label: "CLI: ops" };
export const OK_INPUT = { alt: "Kabel USB-C hitam di atas meja", rightsConfirmed: "true" };

const art = { kind: "cable", bg: "#eee", accent: "#111" };

export function seededImage(id: string, position: number, productId = "B01"): FakeImage {
  return {
    id, productId, position, alt: `Foto ${id}`, hash: createHash("sha256").update(id).digest("hex"), width: 1600, height: 1600,
    sizes: [480, 960, 1600], source: "upload", createdAt: "2026-10-28T10:00:00+07:00", createdBy: "Maya (Marketing)",
  };
}

export function keysOf(image: { productId: string; hash: string; sizes: number[] }): string[] {
  return image.sizes.map((t) => mediaKey(image.productId, image.hash.slice(0, 16), t));
}

export function seedFiles(storage: FakeStorage, image: FakeImage): void {
  for (const key of keysOf(image)) storage.objects.set(key, { body: Buffer.from(image.id), contentType: "image/webp" });
}

export function harness(images: FakeImage[] = []) {
  const db = fakeMediaDb({
    products: [
      { id: "B01", name: "Kabel USB-C", storeId: "sambung", slug: "kabel-usb-c", art },
      { id: "B02", name: "Adaptor", storeId: "sambung", slug: "adaptor", art },
      { id: "A01", name: "Krim", storeId: "halimun", slug: "krim", art },
    ],
    variants: [
      { sku: "B01-1M", productId: "B01", imageId: null, label: "1 m" },
      { sku: "B01-2M", productId: "B01", imageId: null, label: "2 m" },
      { sku: "A01-30", productId: "A01", imageId: null, label: "30 ml" },
    ],
    images,
  });
  const storage = fakeStorage();
  for (const image of images) seedFiles(storage, image);
  const catalog = { refreshAfterWrite: vi.fn(async (): Promise<void> => undefined) };
  const service = new MediaService(db.prisma as unknown as PrismaService, storage, catalog);
  return { ...db, storage, catalog, service };
}

export function file(buffer: Buffer, originalname = "foto.jpg") {
  return { buffer, originalname, size: buffer.length };
}

/** A 600x600 JPEG whose colour (and so hash) depends on n. Gives the targets [480, 600]. */
export function photo(n: number): Promise<Buffer> {
  return solidJpeg(600, 600, { colour: { r: (n * 37) % 256, g: (n * 91) % 256, b: 120 } });
}

/** "ok", or "status CODE message" for an HttpException; anything else is rethrown. */
export async function settle(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const body = error.getResponse() as { code: string; message: string };
    return `${error.getStatus()} ${body.code} ${body.message}`;
  }
}

export function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until(condition: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error("until: condition not met in time");
    await sleep(2);
  }
}

/** Holds every putObject until opened, so an upload stays inside its locked transaction. */
export function gatePuts(storage: FakeStorage) {
  const g = gate();
  let entered = 0;
  const original = storage.putObject.bind(storage);
  storage.putObject = async (key, body, contentType) => {
    entered += 1;
    await g.wait;
    return original(key, body, contentType);
  };
  return { open: g.open, entered: () => entered };
}

type Tx = Parameters<Parameters<ReturnType<typeof fakeMediaDb>["prisma"]["$transaction"]>[0]>[0];

/** Counts transactions started, and can make the next one fail at its audit write (after the files are written). */
export function instrument(prisma: ReturnType<typeof fakeMediaDb>["prisma"]) {
  const original = prisma.$transaction.bind(prisma);
  let started = 0;
  let failAudit = false;
  prisma.$transaction = (async (fn: (tx: Tx) => Promise<unknown>, opts?: unknown) => {
    started += 1;
    return original(async (tx) => {
      if (failAudit) {
        failAudit = false;
        tx.auditRecord.create = async () => { throw new Error("db down"); };
      }
      return fn(tx);
    }, opts);
  }) as typeof prisma.$transaction;
  return { started: () => started, failNextAudit: () => { failAudit = true; } };
}

/** Runs an exception through the upload route filter (and so ApiExceptionFilter) with a stub response. */
export function respond(exception: unknown) {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        headersSent: false,
        setHeader: (name: string, value: string) => { out.headers[name] = value; },
        status: (code: number) => { out.status = code; return { json: (body: unknown) => { out.body = body; } }; },
      }),
    }),
  } as unknown as ArgumentsHost;
  new UploadExceptionFilter().catch(exception, host);
  return out as { status: number; body: { error: { code: string; message: string } }; headers: Record<string, string> };
}
