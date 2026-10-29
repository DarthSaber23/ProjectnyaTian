import { Prisma } from "@prisma/client";

/**
 * Test double for the Prisma calls the media code makes. Unlike fake-db.ts it does NOT serialise transactions:
 * each call yields to the event loop, so races are real. `FOR UPDATE` on a product holds a FIFO per-product lock
 * until the transaction ends, both unique keys are enforced at write time (P2002 with meta.target), a variant link
 * to a missing photo throws P2003, and a throwing transaction rolls back through an undo journal.
 */

export interface FakeImage {
  id: string; productId: string; position: number; alt: string; hash: string; width: number; height: number; sizes: number[]; source: string;
  creator?: string | null; licence?: string | null; licenceUrl?: string | null; sourceUrl?: string | null; retrievedAt?: string | null; licenceCheck?: string | null;
  createdAt: string; createdBy: string;
}
export interface FakeProduct { id: string; name: string; [key: string]: unknown }
export interface FakeVariant { sku: string; productId: string; imageId: string | null; label?: string }
export interface FakeAudit { code: string; object: string; before: unknown; after: unknown; actor?: string; at?: string; action?: string }

type Where = Record<string, unknown>;
const tick = () => new Promise<void>((r) => setImmediate(r));
const matches = (row: object, where: Where = {}) =>
  Object.entries(where).every(([k, v]) => {
    const actual = (row as Record<string, unknown>)[k];
    return v && typeof v === "object" && "in" in v ? (v as { in: unknown[] }).in.includes(actual) : actual === v;
  });
const known = (code: string, message: string, target?: string[]) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "5.22.0", meta: target ? { target } : { field_name: "imageId" } });

export function fakeMediaDb(seed: { products?: FakeProduct[]; variants?: FakeVariant[]; images?: FakeImage[] } = {}) {
  const state = {
    products: (seed.products ?? []).map((p) => ({ ...p })),
    variants: (seed.variants ?? []).map((v) => ({ ...v })),
    images: (seed.images ?? []).map((i) => ({ ...i })),
    audit: [] as FakeAudit[],
  };
  const inject = { p2003OnVariantUpdate: false };
  const holders = new Map<string, number>();
  const queues = new Map<string, Array<() => void>>();
  let txCounter = 0;
  let idCounter = 0;

  async function acquire(productId: string, txId: number): Promise<void> {
    if (holders.get(productId) === txId) return;
    if (!holders.has(productId)) { holders.set(productId, txId); return; }
    await new Promise<void>((resolve) => {
      const queue = queues.get(productId) ?? [];
      queue.push(() => { holders.set(productId, txId); resolve(); });
      queues.set(productId, queue);
    });
  }
  function releaseAll(txId: number): void {
    for (const [productId, holder] of [...holders]) {
      if (holder !== txId) continue;
      holders.delete(productId);
      queues.get(productId)?.shift()?.();
    }
  }

  function uniqueCheck(row: FakeImage): void {
    const others = state.images.filter((i) => i !== row && i.productId === row.productId);
    if (others.some((i) => i.position === row.position)) throw known("P2002", "Unique constraint failed", ["productId", "position"]);
    if (others.some((i) => i.hash === row.hash)) throw known("P2002", "Unique constraint failed", ["productId", "hash"]);
  }

  function client(journal: Array<() => void> | null, txId: number) {
    const record = (undo: () => void) => journal?.push(undo);
    const setField = <T extends object>(row: T, patch: Partial<T>) => {
      const before = { ...row };
      Object.assign(row, patch);
      record(() => Object.assign(row, before));
    };
    return {
      async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        await tick();
        const sql = strings.join("?");
        const id = String(values[0]);
        if (sql.includes('FROM "Product"')) {
          if (!state.products.some((p) => p.id === id)) return [];
          await acquire(id, txId);
          return [{ id }];
        }
        if (sql.includes('FROM "Variant" WHERE "productId"')) {
          return state.variants.filter((v) => v.productId === id).map((v) => ({ sku: v.sku })).sort((a, b) => a.sku.localeCompare(b.sku));
        }
        throw new Error(`fakeMediaDb: unexpected raw query ${sql}`);
      },
      product: {
        async findUnique({ where }: { where: { id: string } }) { await tick(); return state.products.find((p) => p.id === where.id) ?? null; },
        async findMany({ where, include }: { where?: Where; include?: { images?: unknown; variants?: unknown } } = {}) {
          await tick();
          return state.products.filter((p) => matches(p, where)).map((p) => ({
            ...p,
            ...(include?.images ? { images: state.images.filter((i) => i.productId === p.id).sort((a, b) => a.position - b.position).map((i) => ({ ...i })) } : {}),
            ...(include?.variants ? { variants: state.variants.filter((v) => v.productId === p.id).map((v) => ({ ...v })) } : {}),
          }));
        },
      },
      productImage: {
        async findMany({ where, orderBy }: { where?: Where; orderBy?: unknown } = {}) {
          await tick();
          const rows = state.images.filter((i) => matches(i, where)).map((i) => ({ ...i }));
          return orderBy ? rows.sort((a, b) => a.position - b.position) : rows;
        },
        async findFirst({ where }: { where?: Where } = {}) { await tick(); const r = state.images.find((i) => matches(i, where)); return r ? { ...r } : null; },
        async count({ where }: { where?: Where } = {}) { await tick(); return state.images.filter((i) => matches(i, where)).length; },
        async create({ data }: { data: Omit<FakeImage, "id"> & { id?: string } }) {
          await tick();
          const row = { ...data, id: data.id ?? `img_${++idCounter}` } as FakeImage;
          uniqueCheck(row);
          state.images.push(row);
          record(() => state.images.splice(state.images.indexOf(row), 1));
          return { ...row };
        },
        async update({ where, data }: { where: { id: string }; data: Partial<FakeImage> }) {
          await tick();
          const row = state.images.find((i) => i.id === where.id);
          if (!row) throw known("P2025", "Record to update not found");
          const before = { ...row };
          Object.assign(row, data);
          try { uniqueCheck(row); } catch (error) { Object.assign(row, before); throw error; }
          record(() => Object.assign(row, before));
          return { ...row };
        },
        async updateMany({ where, data }: { where?: Where; data: { position?: { increment: number } } }) {
          await tick();
          const rows = state.images.filter((i) => matches(i, where));
          for (const row of rows) setField(row, { position: row.position + (data.position?.increment ?? 0) });
          return { count: rows.length };
        },
        async delete({ where }: { where: { id: string } }) {
          await tick();
          const index = state.images.findIndex((i) => i.id === where.id);
          if (index < 0) throw known("P2025", "Record to delete does not exist");
          const [row] = state.images.splice(index, 1);
          record(() => state.images.splice(index, 0, row!));
          for (const v of state.variants.filter((x) => x.imageId === row!.id)) setField(v, { imageId: null }); // onDelete: SetNull
          return { ...row! };
        },
      },
      variant: {
        async findMany({ where }: { where?: Where } = {}) { await tick(); return state.variants.filter((v) => matches(v, where)).map((v) => ({ ...v })); },
        async findUnique({ where }: { where: { sku: string } }) { await tick(); const v = state.variants.find((x) => x.sku === where.sku); return v ? { ...v } : null; },
        async update({ where, data }: { where: { sku: string }; data: { imageId: string | null } }) {
          await tick();
          if (inject.p2003OnVariantUpdate) { inject.p2003OnVariantUpdate = false; throw known("P2003", "Foreign key constraint failed"); }
          const v = state.variants.find((x) => x.sku === where.sku);
          if (!v) throw known("P2025", "Record to update not found");
          if (data.imageId !== null && !state.images.some((i) => i.id === data.imageId)) throw known("P2003", "Foreign key constraint failed");
          setField(v, { imageId: data.imageId });
          return { ...v };
        },
        async updateMany({ where, data }: { where?: Where; data: { imageId: null } }) {
          await tick();
          if (inject.p2003OnVariantUpdate) { inject.p2003OnVariantUpdate = false; throw known("P2003", "Foreign key constraint failed"); }
          const rows = state.variants.filter((v) => matches(v, where));
          for (const v of rows) setField(v, { imageId: data.imageId });
          return { count: rows.length };
        },
      },
      auditRecord: {
        async create({ data }: { data: FakeAudit }) {
          await tick();
          const entry = { ...data };
          state.audit.push(entry);
          record(() => state.audit.splice(state.audit.indexOf(entry), 1));
          return entry;
        },
        async findFirst({ where }: { where?: Where } = {}) { await tick(); return state.audit.find((a) => matches(a, where)) ?? null; },
      },
    };
  }

  const root = client(null, 0);
  const prisma = {
    ...root,
    async $transaction<T>(fn: (tx: ReturnType<typeof client>) => Promise<T>, _opts?: unknown): Promise<T> {
      const txId = ++txCounter;
      const journal: Array<() => void> = [];
      try {
        return await fn(client(journal, txId));
      } catch (error) {
        for (const undo of journal.reverse()) undo();
        throw error;
      } finally {
        releaseAll(txId);
      }
    },
  };
  return { prisma, state, inject };
}
