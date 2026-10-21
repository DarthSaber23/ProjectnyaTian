import json
import urllib.request

def post(body):
    req = urllib.request.Request(
        "http://127.0.0.1:8080/v1/cart/price",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        payload = json.load(res)
    print(body.get("orderVoucher"), payload.get("total"), payload.get("totalDisplay"), payload.get("subtotal"))

post({
    "brand": "sambung",
    "lines": [{"sku": "B01-2M-BLK", "qty": 2}, {"sku": "B03", "qty": 1}],
    "orderVoucher": "KABEL10",
    "shippingVoucher": "GRATISONGKIR",
    "courierId": "kurir-a",
})
post({
    "brand": "sambung",
    "lines": [{"sku": "B01-2M-BLK", "qty": 2}, {"sku": "B03", "qty": 1}],
    "orderVoucher": "HEMAT50",
})
with urllib.request.urlopen("http://127.0.0.1:8080/v1/catalog?brand=sambung") as res:
    catalog = json.load(res)
print("products", len(catalog["products"]))
