import { useSyncExternalStore } from "react";
import { create } from "zustand";
import type { Staff } from "../mocks/fixtures";
import { admin, backend } from "../services/http";

/** Staff session (separate from the customer session). The token lives in an HttpOnly cookie; this holds who it is. */
interface AdminState {
  user: Staff | null;
  /** False until the staff cookie check has answered, so the admin shell waits instead of redirecting. */
  checked: boolean;
  check(): Promise<void>;
  signIn(user: Staff): void;
  signOut(): void;
}

let pendingCheck: Promise<void> | null = null;

export const useAdmin = create<AdminState>((set, get) => ({
  user: null,
  checked: false,
  check: () => {
    if (get().checked) return Promise.resolve();
    pendingCheck ??= admin.restoreSession()
      .then((user) => set({ user: get().user ?? user }))
      .catch(() => undefined)
      .finally(() => set({ checked: true }));
    return pendingCheck;
  },
  signIn: (user) => set({ user, checked: true }),
  signOut: () => {
    void admin.signOut().catch(() => undefined);
    set({ user: null });
  },
}));

/** Re-render admin screens when mock data changes. */
export function useAdminData() {
  useSyncExternalStore(
    (cb) => {
      const stopAdmin = admin.subscribe(cb);
      const stopBackend = backend.subscribe(cb);
      return () => { stopAdmin(); stopBackend(); };
    },
    () => backend.version + admin.version,
  );
  return admin;
}
