import { HttpException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { toWibIso } from "../domain/time";
import type { Order } from "../domain/types";
import { PrismaService } from "../prisma.service";
import { CatalogService } from "./catalog.service";
import { OrderService } from "./order.service";

/** Extra wait after the D6 payment window, so a last-second payment whose webhook is late still lands. */
export const EXPIRY_GRACE_MINUTES = 5;
const SWEEP_EVERY_MS = 60_000;

export function dueForExpiry(order: Pick<Order, "payment">, now: string, graceMinutes = EXPIRY_GRACE_MINUTES): boolean {
  if (order.payment.status !== "pending" && order.payment.status !== "failed") return false;
  return Date.parse(order.payment.expiresAt) + graceMinutes * 60_000 <= Date.parse(now);
}

/**
 * Releases the stock of unpaid orders whose payment window (QRIS/e-wallet 15 min, VA 24 h) has passed,
 * when no gateway "expire" event arrived. Expiry goes through OrderService.applyPayment, which locks the
 * order, so a second API instance or a racing webhook cannot release stock twice.
 */
@Injectable()
export class ReservationSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReservationSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
    private readonly catalog: CatalogService,
  ) {}

  /** After every module's init, so the catalogue is loaded before the first sweep. */
  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns the order numbers this run expired. A run already in progress makes this one a no-op. */
  async sweep(now = toWibIso(new Date())): Promise<string[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const rows = await this.prisma.orderRecord.findMany({
        where: { OR: [{ payload: { path: ["payment", "status"], equals: "pending" } }, { payload: { path: ["payment", "status"], equals: "failed" } }] },
        select: { number: true, payload: true },
      });
      const expired: string[] = [];
      for (const row of rows) {
        if (!dueForExpiry(row.payload as unknown as Order, now)) continue;
        try {
          await this.orders.applyPayment(row.number, "expired", { refreshCatalog: false }); // one refresh after the batch
          expired.push(row.number);
        } catch (error) {
          if (error instanceof HttpException && error.getStatus() === 409) continue; // settled meanwhile
          this.logger.error(`Could not expire ${row.number}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (expired.length) {
        await this.catalog.refreshAfterWrite();
        this.logger.log(`Expired ${expired.length} unpaid order(s), stock released: ${expired.join(", ")}`);
      }
      return expired;
    } catch (error) {
      this.logger.error(`Reservation sweep failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      this.running = false;
    }
  }
}
