import type { BrandId, Product, ProductImage } from "../domain/types";

/** Who made a photo change. `label` is the audit actor string `Nama (Peran)`, or `CLI: {operator}` with id `cli`. */
export interface MediaActor {
  id: string;
  label: string;
}

export const CLI_ACTOR_ID = "cli";

/** A photo as the admin sees it: the public shape plus position, source, licence fields and who added it. */
export type AdminImage = ProductImage & {
  position: number;
  source: "upload" | "sample";
  creator: string | null;
  licence: string | null;
  licenceUrl: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  licenceCheck: string | null;
  createdAt: string;
  createdBy: string;
};

export interface AdminProduct {
  id: string;
  brand: BrandId;
  slug: string;
  name: string;
  art: Product["art"];
  variants: { sku: string; label: string; imageId: string | null }[];
  images: AdminImage[];
}
