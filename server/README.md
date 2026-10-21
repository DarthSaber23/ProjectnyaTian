# Tian API

NestJS service for the commerce starter. Price, stock display, and the W00 catalogue live here. The browser is not the authority.

This slice covers:

- `GET /health`
- `GET /v1/catalog?brand=sambung|halimun`
- `GET /v1/promotions/active` (price and gift rules only; voucher codes are not listed)
- `POST /v1/shipping/quotes` (W00 fixture couriers)
- `POST /v1/cart/price`

The reference cart (two `B01-2M-BLK`, one `B03`, `KABEL10`, `GRATISONGKIR`, Kurir A) totals **Rp587.250** while the weekend flash sale is inside its window (20–22 Oct 2026, Asia/Jakarta).

## Local source, container runtime

Node on this workstation is too old to run the toolchain. The image builds on Node 22. Docker Desktop must be running for a local build. The dev server already has Docker and is the deploy target.

```bash
cp .env.example .env
# set DATABASE_URL
docker compose up --build
```

Postgres on the dev server is the host install, database `tian`, role `tian_app`. The container uses `host.docker.internal` to reach it. Product files and the health probe use the MinIO bucket `tian-media` on the same host.
