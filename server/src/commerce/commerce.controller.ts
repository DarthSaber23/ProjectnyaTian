import { Body, Controller, Get, Header, Headers, HttpException, Param, Post, Put, Query } from "@nestjs/common";
import type { BrandId } from "../domain/types";
import { search } from "../domain/search";
import { AccountApi } from "./account.api";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { CatalogService, type PriceRequest } from "./catalog.service";
import { OrderService, type CreateOrderBody } from "./order.service";

@Controller()
export class CommerceController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrderService,
    private readonly auth: AuthService,
    private readonly admin: AdminService,
    private readonly accounts: AccountApi,
  ) {}

  @Get("catalog")
  list(@Query("brand") brand?: string, @Query("q") q?: string) {
    const result = this.catalog.list(asBrand(brand));
    if (!q) return result;
    const hits = search(result.products, q);
    const ids = new Set(hits.products.map((product) => product.id));
    return { ...result, products: result.products.filter((product) => ids.has(product.id)), synonymApplied: hits.synonymApplied };
  }

  @Get("promotions/active")
  promotions(@Query("brand") brand?: string) {
    return this.catalog.activePromotions(asBrand(brand));
  }

  @Post("shipping/quotes")
  quotes() {
    return this.catalog.quotes();
  }

  @Post("cart/price")
  price(@Body() body: PriceRequest) {
    return this.catalog.price(body ?? {});
  }

  @Post("auth/sign-in")
  signIn(@Body() body: { email?: string; password?: string }) {
    return this.auth.signInCustomer(body?.email ?? "", body?.password ?? "");
  }

  @Post("me/cart/merge")
  merge(@Headers("authorization") authorization: string | undefined, @Body() body: { brand?: BrandId; account?: { sku: string; qty: number }[]; guest?: { sku: string; qty: number }[]; perLineCap?: number }) {
    return this.accounts.merge(authorization, body ?? {});
  }

  @Get("me/wishlist")
  wishlist(@Headers("authorization") authorization: string | undefined) {
    return this.accounts.listWishlist(authorization);
  }

  @Put("me/wishlist/:productId")
  saveWishlist(@Headers("authorization") authorization: string | undefined, @Param("productId") productId: string) {
    return this.accounts.addWishlist(authorization, productId);
  }

  @Post("me/addresses")
  address(@Headers("authorization") authorization: string | undefined, @Body() body: Record<string, string>) {
    return this.accounts.addAddress(authorization, body ?? {});
  }

  @Get("admin/audit-log")
  audit(@Headers("authorization") authorization: string | undefined) {
    return this.admin.auditLog(authorization);
  }

  @Post("orders")
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreateOrderBody,
  ) {
    const customerId = await this.auth.customerId(authorization);
    return this.orders.create(customerId, idempotencyKey, body ?? {});
  }

  @Get("me/orders")
  async mine(@Headers("authorization") authorization: string | undefined) {
    return this.orders.listForCustomer(await this.auth.customerId(authorization));
  }

  @Get("me/orders/:number")
  async one(@Headers("authorization") authorization: string | undefined, @Param("number") number: string) {
    return this.orders.getForCustomer(await this.auth.customerId(authorization), number);
  }

  @Post("orders/:number/payment-events")
  paymentEvent(
    @Headers("x-simulator-token") token: string | undefined,
    @Param("number") number: string,
    @Body() body: { outcome?: "paid" | "failed" | "expired" },
  ) {
    this.assertSimulator(token);
    if (body?.outcome !== "paid" && body?.outcome !== "failed" && body?.outcome !== "expired") {
      throw new HttpException({ code: "VALIDATION", message: "Outcome pembayaran tidak dikenal." }, 422);
    }
    return this.orders.applyPayment(number, body.outcome);
  }

  @Post("admin/auth/sign-in")
  staffSignIn(@Body() body: { email?: string; password?: string; totp?: string }) {
    return this.auth.signInStaff(body?.email ?? "", body?.password ?? "", body?.totp ?? "");
  }

  @Get("admin/metrics")
  metrics(
    @Headers("authorization") authorization: string | undefined,
    @Query("from") from = "2026-10-14",
    @Query("to") to = "2026-10-20",
    @Query("sessions") sessions = "1240",
  ) {
    return this.admin.metrics(authorization, from, to, Number(sessions));
  }

  @Post("admin/orders/:number/process")
  process(@Headers("authorization") authorization: string | undefined, @Param("number") number: string) {
    return this.admin.process(authorization, number);
  }

  @Post("admin/orders/:number/ship")
  ship(
    @Headers("authorization") authorization: string | undefined,
    @Param("number") number: string,
    @Body() body: { trackingNumber?: string },
  ) {
    return this.admin.ship(authorization, number, body?.trackingNumber ?? "");
  }

  @Post("admin/orders/:number/refunds")
  refund(
    @Headers("authorization") authorization: string | undefined,
    @Param("number") number: string,
    @Body() body: { amount?: number; reason?: string; restock?: boolean },
  ) {
    return this.admin.refund(authorization, number, Number(body?.amount), body?.reason ?? "", !!body?.restock);
  }

  @Get("admin/customers/:id/contact")
  @Header("Cache-Control", "no-store")
  contact(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.admin.contact(authorization, id);
  }

  @Post("admin/customers/:id/contact-reveals")
  reveal(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: { reason?: string; orderNumber?: string },
  ) {
    return this.admin.reveal(authorization, id, body?.reason ?? "", body?.orderNumber ?? "");
  }

  private assertSimulator(token: string | undefined): void {
    const expected = process.env.PAYMENT_SIMULATOR_TOKEN;
    if (!expected || token !== expected) {
      throw new HttpException({ code: "UNAUTHORIZED", message: "Simulator pembayaran tidak diizinkan." }, 401);
    }
  }
}

function asBrand(value: string | undefined): BrandId {
  return value === "halimun" ? "halimun" : "sambung";
}
