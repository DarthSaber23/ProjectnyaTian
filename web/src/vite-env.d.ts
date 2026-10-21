/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND?: "halimun" | "sambung";
  readonly VITE_DEMO_TOOLS?: "true" | "false";
  readonly VITE_API_URL?: string;
  readonly VITE_PAYMENT_SIMULATOR_TOKEN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
