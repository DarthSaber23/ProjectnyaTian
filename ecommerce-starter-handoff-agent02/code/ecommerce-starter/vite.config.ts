import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Release gate for client deployments (`npm run build:client`, mode "client").
 * Fails the build when demo tools are on or when the in-browser mock backend is still imported.
 * Agent 02 makes this build pass by replacing src/services/mock with real service clients.
 */
function clientReleaseGate(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    name: "client-release-gate",
    enforce: "pre",
    buildStart() {
      if (mode !== "client") return;
      if (env.VITE_DEMO_TOOLS !== "false") this.error("Release gate: VITE_DEMO_TOOLS must be \"false\" for a client build.");
    },
    resolveId(source, importer) {
      if (mode === "client" && /services\/mock(\/|$)/.test(source)) {
        this.error(`Release gate: mock services cannot ship in a client build (imported by ${importer ?? "?"}). Replace them with real service clients.`);
      }
      return null;
    },
  };
}

// "singlefile": one-file build for e2e tests (HashRouter). "artifact": one-file build for the hosted review preview (MemoryRouter).
export default defineConfig(({ mode }) => ({
  plugins: [clientReleaseGate(mode), react(), ...(mode === "singlefile" || mode === "artifact" ? [viteSingleFile()] : [])],
  build: { outDir: mode === "artifact" ? "dist-artifact" : mode === "singlefile" ? "dist-preview" : "dist" },
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
}));
