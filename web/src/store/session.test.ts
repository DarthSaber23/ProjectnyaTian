import { afterEach, describe, expect, it, vi } from "vitest";
import { serve } from "../test/fetch-stub";
import { useAdmin } from "./admin";
import { useShop } from "./shop";

afterEach(() => vi.unstubAllGlobals());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const rina = { customerId: "C-0001", name: "Rina Pratama", email: "rina@example.com", method: "password" as const };

describe("customer sign-out", () => {
  it("saves the cart before ending the server session", async () => {
    let finishPut!: () => void;
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (init?.method === "PUT") return new Promise<Response>((resolve) => { finishPut = () => resolve(new Response("{}")); });
      return Promise.resolve(new Response("{}"));
    }));
    useShop.setState({ session: rina, cart: [{ sku: "B01-2M-BLK", qty: 1 }] });
    useShop.getState().signOut();
    await settle();
    expect(calls).toEqual(["PUT /v1/me/cart"]);
    finishPut();
    await settle();
    expect(calls).toEqual(["PUT /v1/me/cart", "POST /v1/auth/sign-out"]);
  });

  it("ends the server session on the demo reset too", async () => {
    const calls = serve({ "POST /v1/auth/sign-out": { body: { ok: true } } });
    useShop.setState({ session: rina, cart: [] });
    useShop.getState().resetAll();
    await settle();
    expect(calls).toContain("POST /v1/auth/sign-out");
  });
});

describe("customer session check", () => {
  it("finishes the check for a guest", async () => {
    serve({ "GET /v1/auth/session": { body: { customer: null } } });
    await useShop.getState().restoreSession();
    expect(useShop.getState()).toMatchObject({ session: null, sessionChecked: true });
  });

  it("finishes the check when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await useShop.getState().restoreSession();
    expect(useShop.getState().sessionChecked).toBe(true);
  });
});

describe("staff session check", () => {
  it("asks the server once however many screens wait for it", async () => {
    const calls = serve({ "GET /v1/admin/auth/session": { body: { staff: null } } });
    await Promise.all([useAdmin.getState().check(), useAdmin.getState().check()]);
    expect(calls).toEqual(["GET /v1/admin/auth/session"]);
    expect(useAdmin.getState()).toMatchObject({ user: null, checked: true });
  });
});
