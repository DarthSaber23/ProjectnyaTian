import { useSyncExternalStore } from "react";
import { create } from "zustand";
import type { Staff } from "../mocks/fixtures";
import { admin, backend } from "../services/mock";

/** Staff session (separate from the customer session). Memory only. */
interface AdminState {
  user: Staff | null;
  signIn(user: Staff): void;
  signOut(): void;
}

export const useAdmin = create<AdminState>((set) => ({
  user: null,
  signIn: (user) => set({ user }),
  signOut: () => set({ user: null }),
}));

/** Re-render admin screens when mock data changes. */
export function useAdminData() {
  useSyncExternalStore((cb) => backend.subscribe(cb), () => backend.version);
  return admin;
}
