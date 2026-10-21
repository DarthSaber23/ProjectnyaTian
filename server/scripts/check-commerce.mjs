import { createHmac } from "crypto";

function decodeBase32(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1000000).padStart(6, "0");
}

async function call(path, { method = "GET", token, headers = {}, body } = {}) {
  const res = await fetch(`http://127.0.0.1:8080${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text}`);
  return json;
}

const staff = await call("/v1/admin/auth/sign-in", {
  method: "POST",
  body: { email: "andi@toko.example", password: "demo-staff-2026", totp: totp(process.env.STAFF_TOTP_SECRET) },
});
const metrics = await call("/v1/admin/metrics?from=2026-10-14&to=2026-10-20&sessions=1240", { token: staff.token });
if (metrics.netRevenue !== 2097000 || metrics.paidOrders !== 8) {
  throw new Error(`metrics mismatch ${metrics.netRevenue} ${metrics.paidOrders}`);
}
console.log("METRICS", metrics.netRevenue, metrics.paidOrders, metrics.aov, metrics.paymentCompletionPct);

const customer = await call("/v1/auth/sign-in", {
  method: "POST",
  body: { email: "rina@example.com", password: "demo-rina-2026" },
});
const key = `check-${Date.now()}`;
const orderBody = {
  brand: "sambung",
  lines: [{ sku: "B07", qty: 1 }],
  courierId: "kurir-a",
  paymentMethod: "qris",
  addressId: "rumah",
};
const first = await call("/v1/orders", {
  method: "POST",
  token: customer.token,
  headers: { "idempotency-key": key },
  body: orderBody,
});
const second = await call("/v1/orders", {
  method: "POST",
  token: customer.token,
  headers: { "idempotency-key": key },
  body: orderBody,
});
if (first.number !== second.number) throw new Error("idempotency failed");
const paid = await call(`/v1/orders/${first.number}/payment-events`, {
  method: "POST",
  headers: { "x-simulator-token": process.env.PAYMENT_SIMULATOR_TOKEN },
  body: { outcome: "paid" },
});
console.log("ORDER", first.number, first.totals.total, paid.payment.status, paid.fulfilment);
