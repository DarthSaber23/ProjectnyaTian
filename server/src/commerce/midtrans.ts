import { createHash } from "crypto";
import type { PaymentMethod } from "../domain/types";

/** Used only when MIDTRANS_SERVER_KEY is unset. Replace it with the sandbox server key to go live. */
export const MIDTRANS_DUMMY_SERVER_KEY = "SB-Midtrans-dummy";

export function midtransServerKey(env: Record<string, string | undefined> = process.env): string {
  return env.MIDTRANS_SERVER_KEY?.trim() || MIDTRANS_DUMMY_SERVER_KEY;
}

/** Midtrans sends gross_amount as a decimal string. Signature uses that exact string. */
export function grossAmount(rupiah: number): string {
  return `${rupiah}.00`;
}

/** SHA512(order_id + status_code + gross_amount + server_key), per Midtrans notification docs. */
export function signatureKey(orderId: string, statusCode: string, gross: string, serverKey: string): string {
  return createHash("sha512").update(`${orderId}${statusCode}${gross}${serverKey}`).digest("hex");
}

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
}

export type MappedPayment = "paid" | "failed" | "expired" | "pending" | "ignore";

export function verifyNotification(body: MidtransNotification, expectedRupiah: number, serverKey: string): MappedPayment {
  const expected = signatureKey(body.order_id, body.status_code, body.gross_amount, serverKey);
  if (expected !== body.signature_key) throw new Error("INVALID_SIGNATURE");
  if (body.gross_amount !== grossAmount(expectedRupiah)) throw new Error("AMOUNT_MISMATCH");
  const status = body.transaction_status;
  if ((status === "settlement" || status === "capture") && body.status_code === "200" && body.fraud_status === "accept") return "paid";
  if (status === "expire") return "expired";
  if (status === "deny" || status === "cancel") return "failed";
  if (status === "pending") return "pending";
  return "ignore";
}

export function paymentType(method: PaymentMethod): "qris" | "bank_transfer" | "gopay" {
  if (method === "va") return "bank_transfer";
  if (method === "ewallet") return "gopay";
  return "qris";
}

/** Core API charge response. Fields match https://docs.midtrans.com/reference/charge-api */
export function chargeResponse(orderId: string, rupiah: number, method: PaymentMethod, expiry: string): Record<string, unknown> {
  const type = paymentType(method);
  const gross = grossAmount(rupiah);
  const base: Record<string, unknown> = {
    status_code: "201",
    status_message: "Success, transaction is successful",
    transaction_id: `sim-${orderId}`,
    order_id: orderId,
    merchant_id: "G000000000",
    gross_amount: gross,
    currency: "IDR",
    payment_type: type,
    transaction_time: expiry.slice(0, 19).replace("T", " "),
    transaction_status: "pending",
    fraud_status: "accept",
    expiry_time: expiry.slice(0, 19).replace("T", " "),
  };
  if (type === "qris") base.qr_string = `00020101021226680016ID.CO.MIDTRANS.WWW011893600912${orderId}`;
  if (type === "bank_transfer") base.va_numbers = [{ bank: "bca", va_number: "8077700000000001" }];
  if (type === "gopay") base.actions = [{ name: "generate-qr-code", method: "GET", url: `https://api.sandbox.midtrans.com/v2/gopay/${orderId}/qr-code` }];
  return base;
}

export function notificationFor(orderId: string, rupiah: number, outcome: "paid" | "failed" | "expired", serverKey: string): MidtransNotification {
  const gross = grossAmount(rupiah);
  const mapped = {
    paid: { status_code: "200", transaction_status: "settlement", fraud_status: "accept" },
    failed: { status_code: "202", transaction_status: "deny", fraud_status: "deny" },
    expired: { status_code: "407", transaction_status: "expire", fraud_status: "accept" },
  }[outcome];
  return {
    order_id: orderId,
    gross_amount: gross,
    signature_key: signatureKey(orderId, mapped.status_code, gross, serverKey),
    ...mapped,
  };
}
