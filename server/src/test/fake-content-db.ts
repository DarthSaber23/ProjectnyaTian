import { Prisma } from "@prisma/client";

/**
 * Test double for the Prisma calls the content code makes. Unique keys throw P2002 with meta.target, a throwing
 * transaction restores every table from a snapshot, article deletes cascade, and `inject.failNextWrite` makes the
 * next write throw once. Calls yield to the event loop, so interleavings are real.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Order = Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];

const tick = () => new Promise<void>((r) => setImmediate(r));
const clone = <T>(v: T): T => structuredClone(v);
const known = (code: string, target?: string[]) =>
  new Prisma.PrismaClientKnownRequestError(code === "P2002" ? "Unique constraint failed" : "Record not found", { code, clientVersion: "5.22.0", meta: target ? { target } : undefined });

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(row[key]);
      if ("lte" in c || "gte" in c || "lt" in c) {
        const v = row[key] as string | null;
        if (v === null || v === undefined) return false;
        return (c.lte === undefined || v <= (c.lte as string)) && (c.gte === undefined || v >= (c.gte as string)) && (c.lt === undefined || v < (c.lt as string));
      }
      if ("not" in c) return row[key] !== c.not;
      if ("has" in c) return (row[key] as unknown[]).includes(c.has);
      return matches(row, c); // compound key such as articleId_lang
    }
    return row[key] === cond;
  });
}

function sortRows<T extends Row>(rows: T[], order?: Order): T[] {
  if (!order) return rows;
  const keys = (Array.isArray(order) ? order : [order]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [k, dir] of keys) {
      const x = a[k] as never, y = b[k] as never;
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function applyData(row: Row, data: Row): void {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "increment" in (v as Row)) row[k] = (row[k] as number) + ((v as { increment: number }).increment);
    else if (v !== undefined) row[k] = v;
  }
}

export interface ContentSeed {
  articles?: Row[];
  texts?: Row[];
  links?: Row[];
  redirects?: Row[];
  overrides?: Row[];
  products?: Row[];
  categories?: Row[];
  staff?: Row[];
}

export function fakeContentDb(seed: ContentSeed = {}) {
  const state = {
    articles: clone(seed.articles ?? []),
    texts: clone(seed.texts ?? []),
    links: clone(seed.links ?? []),
    redirects: clone(seed.redirects ?? []),
    overrides: clone(seed.overrides ?? []),
    products: clone(seed.products ?? []),
    categories: clone(seed.categories ?? []),
    staff: clone(seed.staff ?? []),
    audit: [] as Row[],
  };
  const inject = { failNextWrite: false };
  let ids = 0;

  const write = async () => {
    await tick();
    if (inject.failNextWrite) {
      inject.failNextWrite = false;
      throw new Error("injected write failure");
    }
  };
  const unique = (rows: Row[], row: Row, fields: string[], self?: Row) => {
    if (rows.some((r) => r !== self && fields.every((f) => r[f] === row[f]))) throw known("P2002", fields);
  };
  type ArticleRow = Row & { texts: Row[]; products: Row[]; redirects: Row[] };
  const withArticle = (a: Row, include?: Row): ArticleRow => ({
    ...clone(a),
    ...(include?.texts ? { texts: clone(state.texts.filter((t) => t.articleId === a.id)) } : {}),
    ...(include?.products ? { products: sortRows(clone(state.links.filter((l) => l.articleId === a.id)), { position: "asc" }) } : {}),
    ...(include?.redirects ? { redirects: clone(state.redirects.filter((r) => r.toArticleId === a.id)) } : {}),
  }) as ArticleRow;

  const removeArticle = (row: Row): Row => {
    state.articles.splice(state.articles.indexOf(row), 1);
    for (const table of [state.texts, state.links]) for (const r of table.filter((x) => x.articleId === row.id)) table.splice(table.indexOf(r), 1);
    for (const r of state.redirects.filter((x) => x.toArticleId === row.id)) state.redirects.splice(state.redirects.indexOf(r), 1);
    return row;
  };

  const client = {
    article: {
      async create({ data }: { data: Row }) {
        await write();
        const row = { coverSizes: [], tags: [], sample: false, version: 1, ...data, id: (data.id as string) ?? `art_${++ids}` };
        state.articles.push(row);
        return clone(row);
      },
      async findUnique({ where, include }: { where: Where; include?: Row }) {
        await tick();
        const a = state.articles.find((r) => matches(r, where));
        return a ? withArticle(a, include) : null;
      },
      async findMany({ where, include, orderBy, skip = 0, take }: { where?: Where; include?: Row; orderBy?: Order; skip?: number; take?: number } = {}) {
        await tick();
        const rows = sortRows(state.articles.filter((r) => matches(r, where)), orderBy);
        return rows.slice(skip, take === undefined ? undefined : skip + take).map((a) => withArticle(a, include));
      },
      async count({ where }: { where?: Where } = {}) {
        await tick();
        return state.articles.filter((r) => matches(r, where)).length;
      },
      async update({ where, data }: { where: Where; data: Row }) {
        await write();
        const row = state.articles.find((r) => matches(r, where));
        if (!row) throw known("P2025");
        applyData(row, data);
        return clone(row);
      },
      async updateMany({ where, data }: { where: Where; data: Row }) {
        await write();
        const rows = state.articles.filter((r) => matches(r, where));
        rows.forEach((r) => applyData(r, data));
        return { count: rows.length };
      },
      async delete({ where }: { where: Where }) {
        await write();
        const row = state.articles.find((r) => matches(r, where));
        if (!row) throw known("P2025");
        return clone(removeArticle(row));
      },
      async deleteMany({ where }: { where?: Where } = {}) {
        await write();
        const rows = state.articles.filter((r) => matches(r, where));
        rows.forEach(removeArticle);
        return { count: rows.length };
      },
    },
    articleText: {
      async create({ data }: { data: Row }) {
        await write();
        const row = { seoTitle: null, metaDescription: "", summary: "", body: "", noindex: false, canonicalUrl: null, ...data };
        unique(state.texts, row, ["articleId", "lang"]);
        unique(state.texts, row, ["storeId", "lang", "slug"]);
        state.texts.push(row);
        return clone(row);
      },
      async update({ where, data }: { where: Where; data: Row }) {
        await write();
        const row = state.texts.find((r) => matches(r, where));
        if (!row) throw known("P2025");
        const next = { ...row };
        applyData(next, data);
        unique(state.texts, next, ["storeId", "lang", "slug"], row);
        Object.assign(row, next);
        return clone(row);
      },
      async delete({ where }: { where: Where }) {
        await write();
        const row = state.texts.find((r) => matches(r, where));
        if (!row) throw known("P2025");
        state.texts.splice(state.texts.indexOf(row), 1);
        return clone(row);
      },
      async findFirst({ where }: { where?: Where } = {}) {
        await tick();
        const row = state.texts.find((r) => matches(r, where));
        return row ? clone(row) : null;
      },
      async findMany({ where }: { where?: Where } = {}) {
        await tick();
        return clone(state.texts.filter((r) => matches(r, where)));
      },
    },
    articleProduct: {
      async deleteMany({ where }: { where?: Where } = {}) {
        await write();
        const rows = state.links.filter((r) => matches(r, where));
        rows.forEach((r) => state.links.splice(state.links.indexOf(r), 1));
        return { count: rows.length };
      },
      async createMany({ data }: { data: Row[] }) {
        await write();
        for (const row of data) unique(state.links, row, ["articleId", "productId"]);
        state.links.push(...clone(data));
        return { count: data.length };
      },
      async findMany({ where, orderBy }: { where?: Where; orderBy?: Order } = {}) {
        await tick();
        return clone(sortRows(state.links.filter((r) => matches(r, where)), orderBy));
      },
    },
    slugRedirect: {
      async create({ data }: { data: Row }) {
        await write();
        const row = { ...data, id: (data.id as string) ?? `red_${++ids}` };
        unique(state.redirects, row, ["storeId", "kind", "lang", "fromSlug"]);
        state.redirects.push(row);
        return clone(row);
      },
      async findFirst({ where }: { where?: Where } = {}) {
        await tick();
        const row = state.redirects.find((r) => matches(r, where));
        return row ? clone(row) : null;
      },
      async deleteMany({ where }: { where?: Where } = {}) {
        await write();
        const rows = state.redirects.filter((r) => matches(r, where));
        rows.forEach((r) => state.redirects.splice(state.redirects.indexOf(r), 1));
        return { count: rows.length };
      },
    },
    seoOverride: {
      async upsert({ where, create, update }: { where: Where; create: Row; update: Row }) {
        await write();
        const row = state.overrides.find((r) => matches(r, where));
        if (row) { applyData(row, update); return clone(row); }
        state.overrides.push({ ...create });
        return clone(create);
      },
      async deleteMany({ where }: { where?: Where } = {}) {
        await write();
        const rows = state.overrides.filter((r) => matches(r, where));
        rows.forEach((r) => state.overrides.splice(state.overrides.indexOf(r), 1));
        return { count: rows.length };
      },
      async findMany({ where }: { where?: Where } = {}) {
        await tick();
        return clone(state.overrides.filter((r) => matches(r, where)));
      },
      async findUnique({ where }: { where: Where }) {
        await tick();
        const row = state.overrides.find((r) => matches(r, where));
        return row ? clone(row) : null;
      },
    },
    product: {
      async findMany({ where }: { where?: Where } = {}) { await tick(); return clone(state.products.filter((r) => matches(r, where))); },
      async findUnique({ where }: { where: Where }) { await tick(); const r = state.products.find((x) => matches(x, where)); return r ? clone(r) : null; },
    },
    category: {
      async findMany({ where }: { where?: Where } = {}) { await tick(); return clone(state.categories.filter((r) => matches(r, where))); },
      async findUnique({ where }: { where: Where }) { await tick(); const r = state.categories.find((x) => matches(x, where)); return r ? clone(r) : null; },
    },
    staffAccount: {
      async findUnique({ where }: { where: Where }) { await tick(); const r = state.staff.find((x) => matches(x, where)); return r ? clone(r) : null; },
      async findMany({ where }: { where?: Where } = {}) { await tick(); return clone(state.staff.filter((r) => matches(r, where))); },
      async upsert({ where, create }: { where: Where; create: Row; update: Row }) {
        await write();
        const r = state.staff.find((x) => matches(x, where));
        if (r) return clone(r);
        state.staff.push({ ...create });
        return clone(create);
      },
    },
    auditRecord: {
      async create({ data }: { data: Row }) {
        await write();
        state.audit.push(clone(data));
        return clone(data);
      },
    },
  };

  const prisma = {
    ...client,
    async $transaction<T>(fn: (tx: typeof client) => Promise<T>, _opts?: unknown): Promise<T> {
      const snapshot = clone(state);
      try {
        return await fn(client);
      } catch (error) {
        for (const key of Object.keys(state) as (keyof typeof state)[]) {
          (state[key] as Row[]).splice(0, (state[key] as Row[]).length, ...(snapshot[key] as Row[]));
        }
        throw error;
      }
    },
  };
  return { prisma, state, inject };
}
