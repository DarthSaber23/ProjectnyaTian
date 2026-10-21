import { describe, expect, it } from "vitest";
import { bootShop, pageAvailability } from "./boot";

describe("bootShop", () => {
  it("shows the page before the catalogue request finishes", () => {
    let shown = false;
    bootShop({
      show: () => { shown = true; },
      loadCatalog: () => new Promise(() => undefined),
    });
    expect(shown).toBe(true);
  });
});

describe("pageAvailability", () => {
  it("keeps a direct product URL in a loading state until the catalogue arrives", () => {
    expect(pageAvailability(true, false)).toBe("loading");
    expect(pageAvailability(false, false)).toBe("missing");
    expect(pageAvailability(true, true)).toBe("ready");
  });
});
