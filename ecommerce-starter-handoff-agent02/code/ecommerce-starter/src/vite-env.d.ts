/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND?: "halimun" | "sambung";
  readonly VITE_DEMO_TOOLS?: "true" | "false";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
