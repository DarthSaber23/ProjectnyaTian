import { describe, expect, it, vi } from "vitest";
import { AccountApi } from "./account.api";

describe("AccountApi.updateConsents WIB timestamp", () => {
  it("writes consentEvent.at in Asia/Jakarta (+07:00) ISO format instead of UTC Z", async () => {
    const created: Array<{ key: string; granted: boolean; at: string }> = [];
    const prisma = {
      consentEvent: {
        create: vi.fn(async ({ data }: { data: { key: string; granted: boolean; at: string } }) => {
          created.push(data);
          return data;
        }),
        findMany: vi.fn(async () => created.map((c) => ({ ...c, source: "Pelanggan" }))),
      },
    };
    const auth = { customerId: vi.fn(async () => "C-0001") };
    const api = new AccountApi(prisma as never, auth as never, {} as never);

    await api.updateConsents("Bearer tok", { emailPromo: true });
    expect(created).toHaveLength(1);
    expect(created[0]!.at).toMatch(/\+07:00$/);
  });
});
