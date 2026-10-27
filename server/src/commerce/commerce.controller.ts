import { Body, Controller, Delete, Get, Header, Headers, HttpException, Param, Patch, Post, Put, Query, Req, Res } from "@nestjs/common";
import type { BrandId } from "../domain/types";
import { search } from "../domain/search";
import { AccountApi } from "./account.api";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { CatalogService, type PriceRequest } from "./catalog.service";
import { shippingPrice, type ShippingPriceRequest } from "./kiriminaja";
import { notificationFor, midtransServerKey, type MidtransNotification } from "./midtrans";
import { OrderService, type CreateOrderBody } from "./order.service";
import { clearedCookie, isHttps, sessionCookie, withoutBrowserToken, type SessionKind } from "./session-cookie";

type HttpRequest = { protocol?: string; headers: Record<string, string | string[] | undefined> };
type HttpResponse = { setHeader(name: string, value: string): void };

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
  async signIn(@Body() body: { email?: string; password?: string }, @Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    const result = await this.auth.signInCustomer(body?.email ?? "", body?.password ?? "");
    return this.startSession(req, res, "customer", result);
  }

  @Get("auth/session")
  @Header("Cache-Control", "no-store")
  async session(@Headers("authorization") authorization: string | undefined) {
    return { customer: await this.auth.customerSession(authorization) };
  }

  @Get("products/:slug")
  product(@Param("slug") slug: string) {
    const found = this.catalog.bySlug(slug);
    if (!found) throw new HttpException({ code: "NOT_FOUND", message: "Produk tidak ditemukan." }, 404);
    return found;
  }

  @Get("pages")
  pages() {
    return this.accounts.listPages();
  }

  @Get("pages/:slug")
  page(@Param("slug") slug: string) {
    return this.accounts.page(slug);
  }

  @Post("auth/sign-out")
  signOut(@Headers("authorization") authorization: string | undefined, @Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    res.setHeader("Set-Cookie", clearedCookie("customer", isHttps(req)));
    return this.auth.signOut(authorization);
  }

  @Post("auth/register")
  async register(@Body() body: { name?: string; email?: string; password?: string }, @Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    const result = await this.auth.register(body?.name ?? "", body?.email ?? "", body?.password ?? "");
    return this.startSession(req, res, "customer", result);
  }

  @Post("auth/forgot-password")
  forgot(@Body() body: { email?: string }) {
    return this.auth.forgotPassword(body?.email ?? "");
  }

  @Get("auth/google/start")
  googleStart() {
    return this.auth.googleStart();
  }

  @Get("me/cart")
  cart(@Headers("authorization") authorization: string | undefined, @Query("brand") brand?: string) {
    return this.accounts.cart(authorization, brand);
  }

  @Put("me/cart")
  saveCart(@Headers("authorization") authorization: string | undefined, @Body() body: { brand?: "halimun" | "sambung"; lines?: { sku: string; qty: number }[] }) {
    return this.accounts.saveCart(authorization, body ?? {});
  }

  @Get("me/addresses")
  addresses(@Headers("authorization") authorization: string | undefined) {
    return this.accounts.listAddresses(authorization);
  }

  @Patch("me/addresses/:id")
  patchAddress(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: Record<string, string>) {
    return this.accounts.updateAddress(authorization, id, body ?? {});
  }

  @Delete("me/addresses/:id")
  deleteAddress(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.accounts.deleteAddress(authorization, id);
  }

  @Delete("me/wishlist/:productId")
  deleteWishlist(@Headers("authorization") authorization: string | undefined, @Param("productId") productId: string) {
    return this.accounts.removeWishlist(authorization, productId);
  }

  @Get("me/consents")
  consents(@Headers("authorization") authorization: string | undefined) {
    return this.accounts.consents(authorization);
  }

  @Patch("me/consents")
  patchConsents(@Headers("authorization") authorization: string | undefined, @Body() body: Record<string, boolean>) {
    return this.accounts.updateConsents(authorization, body ?? {});
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

  @Post("shipping/kiriminaja/shipping_price")
  kiriminAjaPrice(@Body() body: ShippingPriceRequest) {
    return shippingPrice(body);
  }

  @Post("webhooks/payment/midtrans")
  midtrans(@Body() body: MidtransNotification) {
    return this.orders.handleMidtrans(body);
  }

  @Post("webhooks/shipping/kiriminaja")
  kiriminAja(@Headers("authorization") authorization: string | undefined, @Body() body: { method?: "processed_packages" | "shipped_packages" | "finished_packages" | "canceled_packages" | "problem_packages"; data?: { order_id?: string; awb?: string }[] }) {
    return this.orders.handleKiriminAja(authorization, body);
  }

  @Post("orders/:number/payment")
  payment(@Headers("authorization") authorization: string | undefined, @Param("number") number: string) {
    return this.auth.customerId(authorization).then((customerId) => this.orders.paymentCharge(customerId, number));
  }

  @Post("orders/:number/payment-events")
  async paymentEvent(
    @Headers("x-simulator-token") token: string | undefined,
    @Param("number") number: string,
    @Body() body: { outcome?: "paid" | "failed" | "expired" },
  ) {
    this.assertSimulator(token);
    if (body?.outcome !== "paid" && body?.outcome !== "failed" && body?.outcome !== "expired") {
      throw new HttpException({ code: "VALIDATION", message: "Outcome pembayaran tidak dikenal." }, 422);
    }
    const order = await this.orders.getByNumber(number);
    const note = notificationFor(order.number, order.totals.total, body.outcome, midtransServerKey());
    await this.orders.handleMidtrans(note);
    return this.orders.getByNumber(number);
  }

  @Post("admin/auth/sign-in")
  async staffSignIn(@Body() body: { email?: string; password?: string; totp?: string }, @Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    const result = await this.auth.signInStaff(body?.email ?? "", body?.password ?? "", body?.totp ?? "");
    return this.startSession(req, res, "staff", result);
  }

  @Get("admin/auth/session")
  @Header("Cache-Control", "no-store")
  async staffSession(@Headers("authorization") authorization: string | undefined) {
    return { staff: await this.auth.staffSession(authorization) };
  }

  @Post("admin/auth/sign-out")
  staffSignOut(@Headers("authorization") authorization: string | undefined, @Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    res.setHeader("Set-Cookie", clearedCookie("staff", isHttps(req)));
    return this.auth.signOut(authorization);
  }

  @Get("admin/orders")
  adminOrders(@Headers("authorization") authorization: string | undefined, @Query("status") status?: string) {
    return this.admin.orders(authorization, status);
  }

  @Get("admin/customers")
  adminCustomers(@Headers("authorization") authorization: string | undefined) {
    return this.admin.customers(authorization);
  }

  @Get("admin/promotions/:code")
  adminPromotion(@Headers("authorization") authorization: string | undefined, @Param("code") code: string) {
    return this.admin.promotion(authorization, code);
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

  /** Customers stay signed in for the session length; staff cookies end with the browser session. */
  private startSession<T extends { token: string }>(req: HttpRequest, res: HttpResponse, kind: SessionKind, result: T) {
    const maxAge = kind === "customer" ? this.auth.sessionSeconds : undefined;
    res.setHeader("Set-Cookie", sessionCookie(kind, result.token, isHttps(req), maxAge));
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    return withoutBrowserToken(result, Array.isArray(origin) ? origin[0] : origin);
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
