import { BrowserRouter, HashRouter, MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CartPage } from "./pages/CartPage";
import { Catalog } from "./pages/Catalog";
import { Checkout } from "./pages/Checkout";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { PaymentPage } from "./pages/PaymentPage";
import { ProductPage } from "./pages/ProductPage";
import { AccountHome, AccountLayout, AddressesPage, OrderDetailPage, OrdersPage, PreferencesPage, RequireAuth, WishlistPage } from "./pages/Account";
import { ComparePage } from "./pages/ComparePage";
import { SearchPage } from "./pages/SearchPage";
import { SignIn } from "./pages/SignIn";
import { AdminLogin, AdminShell } from "./admin/AdminShell";
import { AdminAudit, AdminDashboard, AdminOrderDetail, AdminOrders, AdminPromotions } from "./admin/AdminPages";
import { AdminProductPhotos, AdminProducts } from "./admin/ProductPages";

/** Remount the product page per slug so variant/qty state never leaks between products. */
function ProductRoute() {
  const { slug } = useParams();
  return <ProductPage key={slug} />;
}

/**
 * HashRouter keeps the prototype working on static hosting (and the review preview).
 * A client deployment with server rewrites should switch to BrowserRouter for clean URLs (SEO).
 * The hosted review preview (build mode "artifact") uses MemoryRouter because its frame does not expose hash routes.
 */
const Router = import.meta.env.MODE === "artifact" ? MemoryRouter : import.meta.env.MODE === "client" ? BrowserRouter : HashRouter;
export function App() {
  return (
    <Router>
      <Routes>
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:nomor" element={<AdminOrderDetail />} />
          <Route path="promotions" element={<AdminPromotions />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/:id" element={<AdminProductPhotos />} />
          <Route path="audit-log" element={<AdminAudit />} />
        </Route>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="kategori/:slug" element={<Catalog />} />
          <Route path="produk/:slug" element={<ProductRoute />} />
          <Route path="keranjang" element={<CartPage />} />
          <Route path="checkout/:step" element={<Checkout />} />
          <Route path="pembayaran/:nomor" element={<PaymentPage />} />
          <Route path="cari" element={<SearchPage />} />
          <Route path="bandingkan" element={<ComparePage />} />
          <Route path="masuk" element={<SignIn />} />
          <Route element={<RequireAuth />}>
            <Route path="akun" element={<AccountLayout />}>
              <Route index element={<AccountHome />} />
              <Route path="pesanan" element={<OrdersPage />} />
              <Route path="pesanan/:nomor" element={<OrderDetailPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="alamat" element={<AddressesPage />} />
              <Route path="preferensi" element={<PreferencesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}
