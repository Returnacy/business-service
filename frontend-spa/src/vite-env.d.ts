/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FRONTEND_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  // other env vars...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
