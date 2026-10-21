import { describe, expect, it } from "vitest";
import { computeMetrics } from "../domain/analytics";
import { w00Orders } from "./w00-orders";

describe("W00 order seed", () => {
  it("reproduces net revenue, paid orders, AOV and payment completion", () => {
    const metrics = computeMetrics(w00Orders(), "2026-10-14", "2026-10-20", 1240);
    expect(metrics).toMatchObject({
      netRevenue: 2097000,
      paidOrders: 8,
      aov: 262125,
      conversionPct: 0.65,
      refunds: 237000,
      paymentCompletionPct: 88.9,
      repeatBuyers: { repeat: 2, buyers: 6 },
    });
  });
});
