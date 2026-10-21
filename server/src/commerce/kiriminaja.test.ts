import { describe, expect, it } from "vitest";
import { fulfilmentFor, shippingPrice } from "./kiriminaja";

describe("KiriminAja shipping_price", () => {
  it("returns available W00 couriers with string costs", () => {
    const body = shippingPrice({ origin: 5783, destination: 5507, weight: 1000, item_value: 587250, courier: ["kurir-a"] });
    expect(body.method).toBe("shipping_price");
    expect(body.results).toEqual([
      expect.objectContaining({ service: "kurir-a", cost: "18000", etd: "2-3", service_type: "REG" }),
    ]);
  });

  it("omits a courier with no service", () => {
    const body = shippingPrice({ origin: 5783, destination: 5507, weight: 1000, item_value: 1 });
    expect(body.results.some((row) => row.service === "kurir-d")).toBe(false);
  });
});

describe("KiriminAja webhook events", () => {
  it("maps processed, shipped, and finished onto the fulfilment machine", () => {
    expect(fulfilmentFor("processed_packages", "to_process")).toBe("processing");
    expect(fulfilmentFor("shipped_packages", "processing")).toBe("shipped");
    expect(fulfilmentFor("shipped_packages", "shipped")).toBe("in_transit");
    expect(fulfilmentFor("finished_packages", "in_transit")).toBe("delivered");
    expect(fulfilmentFor("finished_packages", "processing")).toBeNull();
  });
});
