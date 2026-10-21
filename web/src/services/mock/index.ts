import { MockAdmin } from "./admin";
import { backend } from "./backend";

export { backend };
export const admin = new MockAdmin(backend);

/** Resets storefront and admin mock state together ("Atur ulang"). */
export function resetMocks(): void {
  admin.reset();
  backend.reset();
}
