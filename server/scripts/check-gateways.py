import json
import urllib.request

def post(path, body, headers=None):
    req = urllib.request.Request(
        "http://127.0.0.1:8080" + path,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)

quote = post("/v1/shipping/kiriminaja/shipping_price", {
    "origin": 5783,
    "destination": 5507,
    "weight": 1000,
    "item_value": 587250,
    "courier": ["kurir-a"],
})
row = quote["results"][0]
print("QUOTE", quote["method"], row["service"], row["cost"], row["etd"], row["service_type"])

session = post("/v1/auth/sign-in", {"email": "rina@example.com", "password": "demo-rina-2026"})
order = post("/v1/orders", {
    "brand": "sambung",
    "lines": [{"sku": "B07", "qty": 1}],
    "courierId": "kurir-a",
    "paymentMethod": "qris",
    "addressId": "rumah",
}, {"authorization": "Bearer " + session["token"], "idempotency-key": "midtrans-shape"})
charge = post("/v1/orders/" + order["number"] + "/payment", {}, {"authorization": "Bearer " + session["token"]})
print("CHARGE", charge["payment_type"], charge["gross_amount"], charge["transaction_status"], "qr" in charge)
paid = post("/v1/orders/" + order["number"] + "/payment-events", {"outcome": "paid"}, {"x-simulator-token": "dev-simulator"})
print("PAID", paid["payment"]["status"], paid["payment"].get("reference"))
