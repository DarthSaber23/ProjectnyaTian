import { createHash } from "crypto";
import { HttpException, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { Prisma, ProductImage as ImageRow } from "@prisma/client";
import sharp from "sharp";
import { CatalogService } from "../commerce/catalog.service";
import { LOCKED_TX, lockProduct, lockVariants } from "../commerce/order-lock";
import { toWibIso } from "../domain/time";
import type { Product } from "../domain/types";
import { PrismaService } from "../prisma.service";
import { ObjectStorage } from "../storage.service";
import type { SampleEntry } from "./cli/common";
import { toMediaError } from "./error-map";
import { mediaError } from "./errors";
import { ImageJobLimiter } from "./limiter";
import { FILENAME_AUDIT_MAX, MAX_PHOTOS, MAX_UPLOAD_BYTES } from "./limits";
import { logMedia } from "./media-log";
import { CLI_ACTOR_ID, type AdminImage, type AdminProduct, type MediaActor } from "./media.types";
import { configureSharp, inspectImage, processImage } from "./process";
import { mediaKey, toPublicImage } from "./public-image";
import { UploadRateLimiter } from "./rate-limit";
import { renumber } from "./renumber";
import { parseAlt } from "./rules";

const ACTION = {
  PRODUCT_IMAGE_ADDED: "Foto produk ditambahkan",
  PRODUCT_IMAGE_REMOVED: "Foto produk dihapus",
  PRODUCT_IMAGE_REORDERED: "Urutan foto diubah",
  PRODUCT_IMAGE_ALT_CHANGED: "Teks alternatif foto diubah",
  VARIANT_IMAGE_LINKED: "Foto varian ditautkan",
  PRODUCT_IMAGE_FILE_DELETE_FAILED: "File foto gagal dihapus",
} as const;
type MediaCode = keyof typeof ACTION;

const DELETE_ATTEMPTS = 3;

type Db = Pick<Prisma.TransactionClient, "auditRecord">;
type UploadFile = { buffer: Buffer; originalname: string; size: number };

const errorClass = (error: unknown) => (error instanceof Error ? error.name : typeof error);
const keysOf = (row: Pick<ImageRow, "productId" | "hash" | "sizes">) => row.sizes.map((t) => mediaKey(row.productId, row.hash.slice(0, 16), t));

function toAdminImage(row: ImageRow): AdminImage {
  return {
    ...toPublicImage(row),
    position: row.position,
    source: row.source === "sample" ? "sample" : "upload",
    creator: row.creator ?? null,
    licence: row.licence ?? null,
    licenceUrl: row.licenceUrl ?? null,
    sourceUrl: row.sourceUrl ?? null,
    retrievedAt: row.retrievedAt ?? null,
    licenceCheck: row.licenceCheck ?? null,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

/**
 * Product photos (spec section 2). Every read or change of a product's photos runs in one locked transaction that
 * starts with lockProduct, so counts, duplicate checks, positions and id lists are read under the lock. Files are
 * written inside the upload transaction and removed after the delete commits, never while a row still needs them.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  limiter = new ImageJobLimiter();
  rateLimiter = new UploadRateLimiter();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(CatalogService) private readonly catalog: Pick<CatalogService, "refreshAfterWrite">,
  ) {}

  onModuleInit(): void {
    configureSharp();
  }

  async list(): Promise<AdminProduct[]> {
    const rows = await this.prisma.product.findMany({
      orderBy: { id: "asc" },
      include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { sku: "asc" } } },
    });
    return rows.map((row) => ({
      id: row.id,
      brand: row.storeId === "halimun" ? "halimun" : "sambung",
      slug: row.slug,
      name: row.name,
      art: row.art as Product["art"],
      variants: row.variants.map((v) => ({ sku: v.sku, label: v.label, imageId: v.imageId ?? null })),
      images: row.images.map(toAdminImage),
    }));
  }

  async upload(actor: MediaActor, productId: string, file: UploadFile, input: { alt?: string; rightsConfirmed?: string }): Promise<AdminImage> {
    const started = Date.now();
    const fields = { productId, staffId: actor.id, bytes: file.size };
    try {
      const image = await this.addUpload(actor, productId, file, input);
      logMedia("media_upload_ok", { ...fields, imageId: image.id, durationMs: Date.now() - started });
      return image;
    } catch (error) {
      const mapped = toMediaError(error);
      const status = mapped instanceof HttpException ? mapped.getStatus() : 500;
      const durationMs = Date.now() - started;
      if (status === 503) logMedia("storage_unavailable", { ...fields, errorClass: errorClass(error), durationMs });
      else if (status < 500) logMedia("media_upload_rejected", { ...fields, rule: ((mapped as HttpException).getResponse() as { code?: string }).code, durationMs });
      else logMedia("media_processing_failed", { ...fields, errorClass: errorClass(error), durationMs });
      throw mapped;
    }
  }

  async changeAlt(actor: MediaActor, productId: string, imageId: string, input: unknown): Promise<AdminImage> {
    const alt = parseAlt(input);
    const { row, changed } = await this.locked(async (tx) => {
      await lockProduct(tx, productId);
      const found = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!found) throw mediaError("notFound");
      if (found.alt === alt) return { row: found, changed: false };
      const updated = await tx.productImage.update({ where: { id: imageId }, data: { alt } });
      await this.audit(tx, actor, "PRODUCT_IMAGE_ALT_CHANGED", productId, { imageId, alt: found.alt }, { imageId, alt, actorId: actor.id });
      return { row: updated, changed: true };
    });
    if (changed) await this.catalog.refreshAfterWrite();
    return toAdminImage(row);
  }

  async reorder(actor: MediaActor, productId: string, input: unknown): Promise<{ ids: string[] }> {
    const { ids, changed } = await this.locked(async (tx) => {
      await lockProduct(tx, productId);
      if (!Array.isArray(input) || !input.every((id): id is string => typeof id === "string")) throw mediaError("orderInvalid");
      const current = (await tx.productImage.findMany({ where: { productId }, orderBy: { position: "asc" }, select: { id: true } })).map((r) => r.id);
      const wanted = input;
      if (new Set(wanted).size !== wanted.length || wanted.length !== current.length || !wanted.every((id) => current.includes(id))) {
        throw mediaError("orderChanged");
      }
      if (wanted.every((id, i) => current[i] === id)) return { ids: wanted, changed: false };
      await renumber(tx, productId, wanted);
      await this.audit(tx, actor, "PRODUCT_IMAGE_REORDERED", productId, { ids: current }, { ids: wanted, actorId: actor.id });
      return { ids: wanted, changed: true };
    });
    if (changed) await this.catalog.refreshAfterWrite();
    return { ids };
  }

  async remove(actor: MediaActor, productId: string, imageId: string): Promise<{ ok: true }> {
    const started = Date.now();
    const fields = { productId, imageId, staffId: actor.id };
    try {
      this.requireStorage();
    } catch (error) {
      logMedia("storage_unavailable", { ...fields, errorClass: "StorageNotReady" });
      throw error;
    }
    const row = await this.locked(async (tx) => {
      await lockProduct(tx, productId);
      await lockVariants(tx, productId);
      const found = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!found) throw mediaError("notFound");
      // Cleared explicitly before the row goes; onDelete: SetNull is only the backstop.
      await tx.variant.updateMany({ where: { productId, imageId }, data: { imageId: null } });
      await tx.productImage.delete({ where: { id: imageId } });
      const rest = await tx.productImage.findMany({ where: { productId }, orderBy: { position: "asc" }, select: { id: true } });
      await renumber(tx, productId, rest.map((r) => r.id));
      await this.audit(tx, actor, "PRODUCT_IMAGE_REMOVED", productId, found, { actorId: actor.id });
      return found;
    });
    await this.catalog.refreshAfterWrite();

    const left = await this.removeUnusedFiles(productId, row.hash, keysOf(row));
    const durationMs = Date.now() - started;
    if (!left.length) {
      logMedia("media_delete_ok", { ...fields, durationMs });
      return { ok: true };
    }
    try {
      await this.audit(this.prisma, actor, "PRODUCT_IMAGE_FILE_DELETE_FAILED", productId, null, { keys: left, actorId: actor.id });
    } finally {
      logMedia("media_delete_files_failed", { ...fields, durationMs, leftBehindKeys: left });
    }
    return { ok: true };
  }

  async linkVariant(actor: MediaActor, sku: string, imageId: string | null): Promise<{ sku: string; imageId: string | null }> {
    const variant = await this.prisma.variant.findUnique({ where: { sku }, select: { productId: true } });
    if (!variant) throw mediaError("notFound");
    const { productId } = variant;
    const changed = await this.locked(async (tx) => {
      await lockProduct(tx, productId);
      await lockVariants(tx, productId);
      const current = await tx.variant.findUnique({ where: { sku }, select: { productId: true, imageId: true } });
      if (!current || current.productId !== productId) throw mediaError("notFound");
      if (imageId !== null) {
        const image = typeof imageId === "string" ? await tx.productImage.findFirst({ where: { id: imageId, productId }, select: { id: true } }) : null;
        if (!image) throw mediaError("notThisProducts");
      }
      const before = current.imageId ?? null;
      if (before === imageId) return false;
      await tx.variant.update({ where: { sku }, data: { imageId } });
      await this.audit(tx, actor, "VARIANT_IMAGE_LINKED", sku, { imageId: before }, { imageId, actorId: actor.id });
      return true;
    });
    if (changed) await this.catalog.refreshAfterWrite();
    return { sku, imageId };
  }

  /**
   * media:seed only. Adds one validated sample photo unless the product already has an upload, this photo or this
   * position, or a photo of it was ever removed (samples never come back). Uploads only objects missing from storage.
   */
  async addSample(actor: MediaActor, entry: SampleEntry, copies: { target: number; buffer: Buffer }[]): Promise<"added" | "skipped"> {
    const sorted = [...copies].sort((a, b) => a.target - b.target);
    const largest = sorted[sorted.length - 1]!;
    const hash = createHash("sha256").update(largest.buffer).digest("hex");
    const meta = await sharp(largest.buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const sizes = sorted.map((c) => c.target);
    const { productId } = entry;
    const written: string[] = [];
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        await lockProduct(tx, productId);
        if (entry.variantSkus.length) await lockVariants(tx, productId);
        if (await tx.auditRecord.findFirst({ where: { code: "PRODUCT_IMAGE_REMOVED", object: productId }, select: { id: true } })) return "skipped" as const;
        const rows = await tx.productImage.findMany({ where: { productId }, select: { source: true, hash: true, position: true } });
        if (rows.length >= MAX_PHOTOS || rows.some((r) => r.source !== "sample" || r.hash === hash || r.position === entry.position)) return "skipped" as const;
        for (const copy of sorted) {
          const key = mediaKey(productId, hash.slice(0, 16), copy.target);
          if (await this.storage.exists(key)) continue;
          await this.storage.putObject(key, copy.buffer, "image/webp");
          written.push(key);
        }
        const created = await tx.productImage.create({
          data: {
            productId, position: entry.position, alt: entry.alt, hash, width, height, sizes, source: "sample",
            creator: entry.creator, licence: entry.licence, licenceUrl: entry.licenceUrl, sourceUrl: entry.sourceUrl,
            retrievedAt: entry.retrievedAt, licenceCheck: entry.licenceCheck, createdAt: toWibIso(new Date()), createdBy: "seed",
          },
        });
        await this.audit(tx, actor, "PRODUCT_IMAGE_ADDED", productId, null, {
          imageId: created.id, position: entry.position, alt: entry.alt, hash, sizes, width, height, source: "sample", actorId: actor.id,
        });
        for (const sku of entry.variantSkus) {
          await tx.variant.update({ where: { sku }, data: { imageId: created.id } });
          await this.audit(tx, actor, "VARIANT_IMAGE_LINKED", sku, { imageId: null }, { imageId: created.id, actorId: actor.id });
        }
        return "added" as const;
      }, LOCKED_TX);
      if (outcome === "added") await this.catalog.refreshAfterWrite();
      return outcome;
    } catch (error) {
      if (written.length) {
        const left = await this.removeUnusedFiles(productId, hash, written);
        if (left.length) logMedia("media_compensation_failed", { productId, staffId: actor.id, errorClass: errorClass(error), leftBehindKeys: left });
      }
      throw toMediaError(error);
    }
  }

  /** Spec order: rate limit, product, rights, alt, size, type and pixels, processing; then the locked write. */
  private async addUpload(actor: MediaActor, productId: string, file: UploadFile, input: { alt?: string; rightsConfirmed?: string }): Promise<AdminImage> {
    if (actor.id !== CLI_ACTOR_ID && !this.rateLimiter.hit(actor.id)) throw mediaError("rateLimited");
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw mediaError("notFound");
    if (input.rightsConfirmed !== "true") throw mediaError("rightsRequired");
    const alt = parseAlt(input.alt);
    if (file.size > MAX_UPLOAD_BYTES || file.buffer.length > MAX_UPLOAD_BYTES) throw mediaError("tooLarge");
    this.requireStorage();
    const info = await inspectImage(file.buffer);
    const processed = await this.limiter.run(() => processImage(file.buffer, info));

    const written: string[] = [];
    let row: ImageRow;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await lockProduct(tx, productId);
        if (await tx.productImage.findFirst({ where: { productId, hash: processed.hash }, select: { id: true } })) throw mediaError("duplicate");
        const taken = (await tx.productImage.findMany({ where: { productId }, select: { position: true } })).map((r) => r.position);
        if (taken.length >= MAX_PHOTOS) throw mediaError("limitReached");
        let position = 0;
        while (taken.includes(position)) position += 1;
        for (const copy of processed.copies) {
          const key = mediaKey(productId, processed.hash16, copy.target);
          await this.storage.putObject(key, copy.buffer, "image/webp");
          written.push(key);
        }
        const created = await tx.productImage.create({
          data: {
            productId, position, alt, hash: processed.hash, width: processed.width, height: processed.height, sizes: processed.sizes,
            source: "upload", createdAt: toWibIso(new Date()), createdBy: actor.label,
          },
        });
        await this.audit(tx, actor, "PRODUCT_IMAGE_ADDED", productId, null, {
          imageId: created.id, position, alt, hash: processed.hash, sizes: processed.sizes, width: processed.width, height: processed.height,
          source: "upload", rightsConfirmed: true, uploadedBytes: file.size,
          uploadedFilename: [...file.originalname].slice(0, FILENAME_AUDIT_MAX).join(""), actorId: actor.id,
        });
        return created;
      }, LOCKED_TX);
    } catch (error) {
      if (written.length) {
        const left = await this.removeUnusedFiles(productId, processed.hash, written);
        if (left.length) logMedia("media_compensation_failed", { productId, staffId: actor.id, errorClass: errorClass(error), leftBehindKeys: left });
      }
      throw error;
    }
    await this.catalog.refreshAfterWrite();
    return toAdminImage(row);
  }

  /**
   * Removes files under the product lock, and only when no row of the product has the same hash (a quick re-upload
   * of the same photo may own them again). Tries 3 times; answers the keys that are left behind.
   */
  private async removeUnusedFiles(productId: string, hash: string, keys: string[]): Promise<string[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockProduct(tx, productId);
        if (await tx.productImage.findFirst({ where: { productId, hash }, select: { id: true } })) return [];
        for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt += 1) {
          try {
            await this.storage.deleteObjects(keys);
            return [];
          } catch {
            // retried; after the last attempt the keys are reported as left behind
          }
        }
        return keys;
      }, LOCKED_TX);
    } catch {
      return keys;
    }
  }

  private async locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, LOCKED_TX);
    } catch (error) {
      throw toMediaError(error);
    }
  }

  private requireStorage(): void {
    if (!this.storage.ready) throw mediaError("storageUnavailable");
  }

  private audit(db: Db, actor: MediaActor, code: MediaCode, object: string, before: unknown, after: Record<string, unknown>) {
    return db.auditRecord.create({
      data: {
        at: toWibIso(new Date()),
        actor: actor.label,
        code,
        action: ACTION[code],
        object,
        ...(before === null ? {} : { before: before as Prisma.InputJsonValue }),
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}
