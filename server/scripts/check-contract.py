import json
import urllib.request

def get(path, token=None):
    req = urllib.request.Request("http://127.0.0.1:8080" + path)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as res:
        return json.load(res)

def post(path, body):
    req = urllib.request.Request(
        "http://127.0.0.1:8080" + path,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as err:
        return err.code, json.load(err)

product = get("/v1/products/kabel-usb-c-100w-braided")
pages = get("/v1/pages")
google_req = urllib.request.Request("http://127.0.0.1:8080/v1/auth/google/start")
try:
    with urllib.request.urlopen(google_req) as res:
        google = (res.status, json.load(res))
except urllib.error.HTTPError as err:
    google = (err.code, json.load(err))
status, session = post("/v1/auth/sign-in", {"email": "rina@example.com", "password": "demo-rina-2026"})
token = session["token"]
addresses = get("/v1/me/addresses", token)
wishlist = get("/v1/me/wishlist", token)
consents = get("/v1/me/consents", token)
cart = get("/v1/me/cart?brand=sambung", token)
print("PRODUCT", product["product"]["name"])
print("PAGES", [page["slug"] for page in pages])
print("GOOGLE", google[0], google[1]["error"]["code"])
print("ADDRESSES", [row["id"] for row in addresses])
print("WISHLIST", [row["productId"] for row in wishlist])
print("CONSENT_KEYS", sorted(consents.keys()))
print("CART", cart["lines"])
