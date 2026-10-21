import type { Prisma } from "@prisma/client";
import { demoCustomer, seedAudit, seedConsents, seedWishlist } from "../data/fixtures";
import type { PrismaService } from "../prisma.service";
import { encryptField } from "./field-crypto";

const PAGES = [
  { slug: "tentang", title: "Tentang kami", status: "published", blocks: [{ type: "heading", text: "Tentang toko" }, { type: "paragraph", text: "Teks contoh untuk halaman tentang. [isi oleh pemilik]" }] },
  { slug: "faq", title: "Pertanyaan umum", status: "published", blocks: [{ type: "heading", text: "Pengiriman" }, { type: "paragraph", text: "Perkiraan kirim mengikuti kurir yang dipilih. Bukan jaminan tanggal tiba." }] },
  { slug: "kebijakan-privasi", title: "Kebijakan privasi", status: "published", blocks: [{ type: "paragraph", text: "[isi oleh pemilik]" }] },
];

/** Idempotent W00 extras so a database that already has customers still gains addresses, consent, wishlist, and pages. */
export async function seedDummyExtras(prisma: PrismaService): Promise<void> {
  const secret = process.env.ADDRESS_ENCRYPTION_KEY?.trim() ?? "dev-address-key";
  const addresses = [
    { id: "rumah", label: "Rumah", recipient: demoCustomer.name, phone: "081200001234", province: "Jawa Barat", city: "Kota Bandung", district: "Coblong", postalCode: "40132", detail: "Jl. Melati No. 12", kelurahan: "Dago" },
    { id: "kantor", label: "Kantor", recipient: demoCustomer.name, phone: "081200001234", province: "Jawa Barat", city: "Kota Bandung", district: "Sumur Bandung", postalCode: "40111", detail: "Jl. Kenanga No. 8", kelurahan: null as string | null },
  ];
  for (const address of addresses) {
    await prisma.addressRecord.upsert({
      where: { id: address.id },
      update: {},
      create: {
        ...address,
        customerId: demoCustomer.id,
        phone: encryptField(address.phone, secret),
        detail: encryptField(address.detail, secret),
      },
    });
  }
  const existingConsent = await prisma.consentEvent.count({ where: { customerId: demoCustomer.id } });
  if (existingConsent === 0) {
    for (const [key, record] of Object.entries(seedConsents)) {
      await prisma.consentEvent.create({
        data: { customerId: demoCustomer.id, key, granted: record.granted, at: record.changedAt, source: record.source },
      });
    }
  }
  for (const productId of seedWishlist.sambung) {
    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: demoCustomer.id, productId } },
      update: {},
      create: { customerId: demoCustomer.id, productId },
    });
  }
  await prisma.savedCart.upsert({
    where: { id: `${demoCustomer.id}:sambung` },
    update: {},
    create: { id: `${demoCustomer.id}:sambung`, customerId: demoCustomer.id, brand: "sambung", lines: [{ sku: "B01-2M-BLK", qty: 1 }] as Prisma.InputJsonValue },
  });
  for (const page of PAGES) {
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, status: page.status, blocks: page.blocks as Prisma.InputJsonValue },
      create: { ...page, blocks: page.blocks as Prisma.InputJsonValue },
    });
  }
  if ((await prisma.auditRecord.count()) === 0) {
    for (const entry of seedAudit) {
      await prisma.auditRecord.create({ data: { at: entry.at, actor: entry.actor, code: entry.code, action: entry.action, object: entry.object } });
    }
  }
}
