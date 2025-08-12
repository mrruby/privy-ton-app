/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_TON_API_KEY?: string
  readonly VITE_TONAPI_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}