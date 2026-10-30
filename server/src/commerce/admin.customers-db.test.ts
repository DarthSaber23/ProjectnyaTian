import { describe, expect, it, vi } from "vitest";
import { AdminService } from "./admin.service";
import { encryptField } from "./field-crypto";

describe("AdminService database customer queries", () => {
  const secret = "0123456789abcdef0123456789abcdef";

  it("merges prisma.customerAccount rows with W00 fixtures, preserves id, and handles customers with no saved address or encrypted address", async () => {
    process.env.ADDRESS_ENCRYPTION_KEY = secret;
    const prisma = {
      customerAccount: {
        findMany: vi.fn(async () => [
          {
            id: "C-9001",
            name: "Bunga Lestari",
            email: "bunga@example.com",
            phone: "0811-2233-4455",
            addresses: [
              {
                detail: encryptField("Jl. Diponegoro No. 10", secret),
                district: "Kec. Bandung Wetan",
                city: "Kota Bandung",
                postalCode: "40115",
              },
            ],
          },
          {
            id: "C-9002",
            name: "Tanpa Alamat",
            email: "tanpa@example.com",
            phone: "0811-0000-0000",
            addresses: [],
          },
        ]),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "C-9001"
            ? {
                id: "C-9001",
                name: "Bunga Lestari",
                email: "bunga@example.com",
                phone: "0811-2233-4455",
                addresses: [],
              }
            : null,
        ),
      },
      revealGrant: { findFirst: vi.fn(async () => null) },
    };
    const auth = {
      staff: vi.fn(async (h?: string) => ({
        id: "U-01",
        name: "Andi",
        role: h === "Bearer ops" ? "operations" : "owner",
      })),
    };
    const service = new AdminService(prisma as never, auth as never, {} as never);

    const ownerList = await service.customers("Bearer owner");
    const c9001 = ownerList.find((c) => c.id === "C-9001");
    const c9002 = ownerList.find((c) => c.id === "C-9002");
    expect(c9001).toMatchObject({
      id: "C-9001",
      name: "Bunga Lestari",
      address: "Jl. Diponegoro No. 10, Kec. Bandung Wetan, Kota Bandung 40115",
      full: true,
    });
    expect(c9002?.address).toBe("Alamat belum diatur");

    const opsContact = await service.contact("Bearer ops", "C-9001");
    expect(opsContact.id).toBe("C-9001");
    expect(opsContact.full).toBe(false);
    expect(opsContact.address).toBe("Jalan disamarkan");
  });
});
