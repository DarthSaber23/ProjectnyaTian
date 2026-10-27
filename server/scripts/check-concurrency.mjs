// Concurrency check against a running API (dev, not production): no overselling, no double settlement, no deadlocks.
//   BASE_URL=http://43.159.54.222 PAYMENT_SIMULATOR_TOKEN=... node scripts/check-concurrency.mjs
// Creates orders for the demo customer. Unpaid ones are expired at the end, which releases their stock;
// the duplicate-payment check keeps one paid unit of the plentiful SKU.
const base = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const simulator = process.env.PAYMENT_SIMULATOR_TOKEN;
if (!simulator) throw new Error("Set PAYMENT_SIMULATOR_TOKEN to the API's value (server/.env).");

async function call(path, { method = "GET", token, headers = {}, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : {} };
}

const failures = [];
const check = (ok, message) => { console.log(`${ok ? "PASS" : "FAIL"} ${message}`); if (!ok) failures.push(message); };

async function stock() {
  const { json } = await call("/v1/catalog?brand=sambung");
  const out = {};
  for (const product of json.products) {
    if (product.components) continue;
    for (const v of product.variants) out[v.sku] = { onHand: v.onHand, reserved: v.reserved, available: v.available };
  }
  return out;
}

let run = 0;
function order(token, lines) {
  run += 1;
  return call("/v1/orders", {
    method: "POST",
    token,
    headers: { "idempotency-key": `concurrency-${Date.now()}-${run}` },
    body: { brand: "sambung", lines, courierId: "kurir-a", paymentMethod: "qris", addressId: "rumah" },
  });
}

const payment = (number, outcome) =>
  call(`/v1/orders/${number}/payment-events`, { method: "POST", headers: { "x-simulator-token": simulator }, body: { outcome } });

/** Expires unpaid test orders one by one; also proves the expire path releases exactly what was reserved. */
async function expireAll(numbers) {
  for (const number of numbers) await payment(number, "expired");
}

const signIn = await call("/v1/auth/sign-in", { method: "POST", body: { email: "rina@example.com", password: "demo-rina-2026" } });
if (signIn.status !== 201 && signIn.status !== 200) throw new Error(`customer sign-in ${signIn.status}`);
const token = signIn.json.token;
const start = await stock();
const plentiful = Object.entries(start).filter(([, s]) => s.available >= 25).map(([sku]) => sku).sort();
if (plentiful.length < 2) throw new Error("Need two SKUs with at least 25 available.");
const [x, y] = plentiful;

// 1. The same "paid" event twice at the same moment settles once.
{
  const before = (await stock())[x];
  const created = await order(token, [{ sku: x, qty: 1 }]);
  check(created.status === 201, `order for duplicate-payment check created (${created.status})`);
  const number = created.json.number;
  const results = await Promise.all([payment(number, "paid"), payment(number, "paid")]);
  check(results.every((r) => r.status === 201 && r.json.payment?.status === "paid"), "both duplicate webhooks answered 2xx with the order paid");
  const after = (await stock())[x];
  check(after.onHand === before.onHand - 1 && after.reserved === before.reserved, `${x} committed once: onHand ${before.onHand}→${after.onHand}, reserved ${before.reserved}→${after.reserved}`);
  const mine = await call(`/v1/me/orders/${number}`, { token });
  const paidEntries = (mine.json.history ?? []).filter((h) => h.status === "Dibayar").length;
  check(paidEntries === 1, `order history shows one payment (${paidEntries})`);
}

// 2. More simultaneous buyers than units left: never more orders than stock.
//    Scarcity is made here (one order holds all but 3 units) so the check always runs.
{
  const left = 3;
  const buyers = 8;
  const before = await stock();
  const sku = Object.keys(before).filter((s) => s !== x && before[s].available > left).sort()[0];
  if (!sku) throw new Error(`Need a third SKU with more than ${left} available.`);
  const s = before[sku];
  const holder = await order(token, [{ sku, qty: s.available - left }]);
  check(holder.status === 201, `${sku}: one order holds ${s.available - left} of ${s.available}, leaving ${left}`);
  const results = await Promise.all(Array.from({ length: buyers }, () => order(token, [{ sku, qty: 1 }])));
  const ok = results.filter((r) => r.status === 201);
  const short = results.filter((r) => r.status === 409 && r.json.error?.code === "STOCK_SHORTAGE");
  check(ok.length === left && short.length === buyers - left, `${sku}: ${buyers} buyers for ${left} units → ${ok.length} orders, ${short.length} out of stock`);
  check(results.every((r) => r.status < 500), "no server errors in the last-units race");
  const mid = (await stock())[sku];
  check(mid.available === 0 && mid.reserved === s.reserved + s.available, `${sku} sold out exactly: reserved ${s.reserved}→${mid.reserved}, available ${mid.available}`);
  await expireAll([holder.json.number, ...ok.map((r) => r.json.number)]);
  const end = (await stock())[sku];
  check(end.reserved === s.reserved && end.onHand === s.onHand, `${sku} back to reserved ${end.reserved}, onHand ${end.onHand} after expiry`);
}

// 3. Carts holding the same two SKUs in opposite order, all at once: no deadlock, no 500.
{
  const before = await stock();
  const pairs = 10;
  const results = await Promise.all(Array.from({ length: pairs * 2 }, (_, i) =>
    order(token, i % 2 ? [{ sku: x, qty: 1 }, { sku: y, qty: 1 }] : [{ sku: y, qty: 1 }, { sku: x, qty: 1 }])));
  const errors = results.filter((r) => r.status >= 500);
  check(errors.length === 0, `${pairs * 2} opposite-order carts: ${results.filter((r) => r.status === 201).length} created, ${errors.length} server errors`);
  const mid = await stock();
  const created = results.filter((r) => r.status === 201);
  check(mid[x].reserved === before[x].reserved + created.length && mid[y].reserved === before[y].reserved + created.length, `${x} and ${y} reserved once per order`);
  await expireAll(created.map((r) => r.json.number));
  const end = await stock();
  check(end[x].reserved === before[x].reserved && end[y].reserved === before[y].reserved, `${x} and ${y} reservations released after expiry`);
}

console.log(failures.length ? `concurrency check FAILED (${failures.length})` : "concurrency check ok");
process.exitCode = failures.length ? 1 : 0;
