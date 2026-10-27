import { describe, expect, it } from "vitest";
import { bootShop, pageAvailability } from "./boot";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("bootShop", () => {
  it("shows the page before the catalogue request finishes", () => {
    let shown = false;
    bootShop({
      show: () => { shown = true; },
      loadCatalog: () => new Promise(() => undefined),
      restoreSession: async () => undefined,
    });
    expect(shown).toBe(true);
  });

  it("restores the session only after the catalogue arrives, so the saved cart can be priced", async () => {
    let release!: () => void;
    const restored: boolean[] = [];
    bootShop({
      show: () => undefined,
      loadCatalog: () => new Promise<void>((resolve) => { release = resolve; }),
      restoreSession: async () => { restored.push(true); },
    });
    await settle();
    expect(restored).toEqual([]);
    release();
    await settle();
    expect(restored).toEqual([true]);
  });

  it("still restores the session when the catalogue fails", async () => {
    const restored: boolean[] = [];
    bootShop({
      show: () => undefined,
      loadCatalog: () => Promise.reject(new Error("offline")),
      restoreSession: async () => { restored.push(true); },
    });
    await settle();
    expect(restored).toEqual([true]);
  });
});

describe("pageAvailability", () => {
  it("keeps a direct product URL in a loading state until the catalogue arrives", () => {
    expect(pageAvailability(true, false)).toBe("loading");
    expect(pageAvailability(false, false)).toBe("missing");
    expect(pageAvailability(true, true)).toBe("ready");
  });
});
