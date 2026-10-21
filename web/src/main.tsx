import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { backend } from "./services/http/backend";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");
void backend.ready().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
