# Daftar periksa sebelum peluncuran

Checks the owner or operator completes before a client's shop goes live. Commands run on the client's server in the deployed tree.

## Before launch

1. **Ganti atau hapus foto contoh.** Remove every demo photo, then restart the API so the catalogue reloads:

   ```bash
   docker compose exec api npm run media:remove-samples -- --operator "<nama>"
   docker compose restart api
   ```

   Confirm in Postgres that none is left, and that `GET /v1/catalog` has no photo with `"sample": true`:

   ```sql
   SELECT count(*) FROM "ProductImage" WHERE source = 'sample';
   ```

   The count must be 0. Products without a real photo fall back to their drawing until staff upload one in Admin › Produk.

2. **Foto sudah dicadangkan.** A copy of the bucket's `media/` prefix exists outside the MinIO volume (see "Deploy backup step" in `architecture.md`), and the staff know to keep their original photo files: the shop keeps only resized copies.

3. **Removed photos stay in browsers.** Photo files are cached by visitors' browsers for up to one year. Removing a photo takes it out of the shop and the catalogue, but a returning visitor who already loaded it may still see their cached copy. Do not rely on removal for a licence takedown.
