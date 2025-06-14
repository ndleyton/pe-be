// This file augments Vite's built-in `ImportMetaEnv` typings with app-specific
// environment variables. Any variable added here must also be exposed by
// Vite via the `VITE_` prefix.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // add more custom env vars here...
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 