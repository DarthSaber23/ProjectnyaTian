import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { bootShop } from "./boot";
import { backend } from "./services/http/backend";
import { useShop } from "./store/shop";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");
bootShop({
  show: () => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  },
  loadCatalog: () => backend.ready(),
  restoreSession: () => useShop.getState().restoreSession(),
});
