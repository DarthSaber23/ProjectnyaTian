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

2. **Hapus artikel contoh.** Remove the demo articles (their URLs then answer 404), then restart the API:

   ```bash
   docker compose exec api npm run content:remove-samples -- --operator "<nama>"
   docker compose restart api
   ```

   ```sql
   SELECT count(*) FROM "Article" WHERE sample = true;
   ```

   The count must be 0.

3. **Alamat dan nama toko untuk mesin pencari.** In `server/.env` set `PUBLIC_BASE_URL` to the shop's public `https://` address (no trailing slash) and `SITE_BRAND` to the shop's brand id, then restart the API. Open `/robots.txt` and `/sitemap.xml` on the live address: robots names the sitemap with the same address, and the sitemap lists `/blog`, each live article (with its English version when there is one), products and categories.

4. **Search Console.** In the owner's own Google account, verify the domain (or set `GOOGLE_SITE_VERIFICATION`) and submit `https://<domain>/sitemap.xml`. Run the Rich Results Test on one article and one product page.

5. **Akun demo staf.** Remove or re-password the demo staff accounts (including the SEO account `sinta@toko.example` added by `content:seed`); they share a published demo password.

6. **Foto sudah dicadangkan.** A copy of the bucket's `media/` prefix exists outside the MinIO volume (see "Deploy backup step" in `architecture.md`), and the staff know to keep their original photo files: the shop keeps only resized copies.

7. **Removed photos stay in browsers.** Photo files are cached by visitors' browsers for up to one year. Removing a photo takes it out of the shop and the catalogue, but a returning visitor who already loaded it may still see their cached copy. Do not rely on removal for a licence takedown.
