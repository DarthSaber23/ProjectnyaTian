import type { Order } from "../domain/types";

type Stock = Record<string, { onHand: number; reserved: number }>;

/**
 * Test double for the Prisma calls the order and admin services make. Transactions run one at a time
 * (like row locks on one order) and roll back when they throw, so a decision taken on a read made
 * outside the transaction shows up as a stale read.
 */
export function fakeDb(order: Order, stock: Stock, storeId = "sambung") {
  const state = { payload: structuredClone(order), stock: structuredClone(stock), outbox: 0, audit: [] as { code: string; action: string }[] };
  let chain: Promise<unknown> = Promise.resolve();
  const row = () => ({ number: order.number, storeId, customerId: order.customerId, payload: structuredClone(state.payload) });
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join("?").includes('"OrderRecord"')) return [row()];
      const skus = (Array.isArray(values[0]) ? values[0] : [values[0]]) as string[];
      return skus.filter((sku) => state.stock[sku]).map((sku) => ({ sku, ...state.stock[sku] }));
    },
    variant: {
      update: async ({ where, data }: { where: { sku: string }; data: { onHand: number; reserved: number } }) => {
        state.stock[where.sku] = { onHand: data.onHand, reserved: data.reserved };
      },
    },
    orderRecord: {
      findUnique: async () => row(),
      update: async ({ data }: { data: { payload: unknown } }) => { state.payload = structuredClone(data.payload) as Order; },
    },
    notificationOutbox: { create: async () => { state.outbox += 1; } },
    auditRecord: { create: async ({ data }: { data: { code: string; action: string } }) => { state.audit.push({ code: data.code, action: data.action }); } },
  };
  const prisma = {
    ...tx,
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>): Promise<T> => {
      const run = chain.then(async () => {
        const before = structuredClone({ payload: state.payload, stock: state.stock, outbox: state.outbox, audit: state.audit });
        try {
          return await fn(tx);
        } catch (error) {
          Object.assign(state, before);
          throw error;
        }
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };
  return { prisma, state };
}
