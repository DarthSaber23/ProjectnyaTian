# Architecture

The shop and the API run as two containers on one dev server. SSH is how this workspace reaches that machine. Connection values live only in the root `.env`, which git ignores. This file names those variables. It does not copy them.

## Dev server

| Variable | Use |
|---|---|
| `POSTGRES_IP` | Public IPv4 of the dev server. SSH and the published app ports use this address. |
| `SERVER_NAME` | SSH username. It is `ubuntu`. |
| `SSH_NAME` | Cloud instance name. It is not the SSH user and it is not passed to `ssh`. |
| `SSH_PUBLIC` | Public key registered for this login. |
| `PRIVATE KEY` | Base64 body of the matching OpenSSH ed25519 private key. The variable name contains a space. |

SSH listens on port **22**.

## Build the key file

`PRIVATE KEY` is the base64 text that belongs between the OpenSSH armor lines. Decode it only to confirm it starts with `openssh-key-v1`. Write the PEM with that base64 still encoded, wrapped at 70 characters:

```
-----BEGIN OPENSSH PRIVATE KEY-----
<PRIVATE KEY value, wrapped>
-----END OPENSSH PRIVATE KEY-----
```

Writing the decoded bytes straight into the file produces a key OpenSSH rejects.

On Windows, restrict the file to the current user, then connect:

```powershell
icacls $keyPath /inheritance:r /grant:r "${env:USERNAME}:(R)"
ssh -i $keyPath -o StrictHostKeyChecking=accept-new ubuntu@<POSTGRES_IP>
```

A working check is `echo ssh-ok`. If TCP connects and the client reports `kex_exchange_identification: read: Connection reset` before any banner, the server is not offering SSH yet. Fix port 22 on the instance before retrying. Do not print the key or any `.env` password into the terminal log.

## What is running

The deployed tree on the server is `/home/ubuntu/tian`. Root `docker-compose.yml` starts two services:

| Public address | Process |
|---|---|
| `POSTGRES_IP:80` | `tian-web-1`. nginx serves the React storefront and proxies `/v1/` and `/health` to the API container. |
| `POSTGRES_IP:8080` | `tian-api-1`. NestJS commerce API. |
| `POSTGRES_IP:443` | Firewall can be open. Nothing serves TLS until a certificate is installed. |
| `POSTGRES_IP:8081` | No longer the storefront. The web container publishes port 80. |

Postgres and MinIO stay on the host, not in Compose. The API container reaches them through `host.docker.internal`. Database name, user, and port are `POSTGRES_DB_NAME`, `POSTGRES_USER`, and `POSTGRES_PORT` in the root `.env`. The API process reads `server/.env` at runtime. Neither env file belongs in git.

## Product photos

Photos live in the MinIO bucket `MINIO_BUCKET` (default `tian-media`) under `media/products/{productId}/{hash16}-{target}.webp`. MinIO stays off the public internet; only nginx on the same host reads it.

- **Bucket policy.** At start-up the API writes one policy: anonymous `s3:GetObject` on `arn:aws:s3:::<bucket>/media/*` and nothing else, then reads it back and compares it by meaning. Listing and every other prefix stay private. Until that succeeds the API reports `storage: degraded` on `/health` and photo uploads answer 503; checkout is unaffected.
- **MinIO key rights.** The API key needs `s3:PutBucketPolicy`, `s3:GetBucketPolicy` and `s3:DeleteObject` on the bucket, besides put and get.
- **nginx.** `web/nginx.conf` is a template (`/etc/nginx/templates/default.conf.template`). Compose passes only `MINIO_BUCKET` and `MEDIA_UPSTREAM` (default `http://host.docker.internal:9000`) to the web container, set in the root `.env` (see `.env.example`); web never receives `server/.env`. `/media/` serves only names that match the allowlist pattern, GET only, without cookies or query string, with `immutable` caching; anything else is a plain 404. Only the upload path accepts an 11 MB body.
- **Demo photos.** Run `npm run media:seed` and `npm run media:remove-samples -- --operator "<nama>"` by hand inside the API container (`docker compose exec api …`), then `docker compose restart api`.

## Blog and search pages

- **Renderer.** nginx sends `/blog`, `/en/blog`, `/produk/…` and `/kategori/…` to the API's `GET /render?path=…`, which fetches the built `index.html` from the web container (`http://web/__shell.html`, private ranges only, cached 60 s) and fills in the title, meta tags, JSON-LD and page text. Pages are cached 60 s with an ETag; an article change clears the cache at once, catalogue changes show within 60 s. If the API fails, nginx serves the plain `index.html` (`@spa`).
- **Settings in `server/.env`.** `PUBLIC_BASE_URL` (the public address used in canonical, Open Graph and the sitemap; dev: `http://43.159.54.222`), `SITE_BRAND` (`sambung` or `halimun`: the store whose articles and pages are public), optional `GOOGLE_SITE_VERIFICATION`. The API refuses to start with an invalid `SITE_BRAND`.
- **Article images** live in the same bucket under `media/articles/{articleId}/{hash16}-{target}.webp` and are served by the same nginx `/media/` rule.
- **Demo articles.** Run `npm run content:seed` and `npm run content:remove-samples -- --operator "<nama>"` by hand inside the API container, then `docker compose restart api`. The seed adds the demo SEO account (`U-05`) when it is missing.

## Deploy backup step

Until the scheduled backups of milestone B9, every deploy starts with a backup kept off the MinIO volume, in a dated folder (for example `/home/ubuntu/backups/2026-10-29/`):

1. Postgres: `pg_dump` of the database `POSTGRES_DB_NAME` into that folder.
2. Photos: mirror the bucket's `media/` prefix into that folder (`mc mirror <alias>/<bucket>/media <folder>/media`).
3. A listing to compare later: `mc ls --recursive <alias>/<bucket>/media > <folder>/media-listing.txt`.

Staff keep their original photo files; the shop stores only resized copies.
