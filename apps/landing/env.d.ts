/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where "Sign in" and "Open the dashboard" lead. */
  readonly VITE_DASHBOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
