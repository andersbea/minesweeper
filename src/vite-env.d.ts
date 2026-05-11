/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

/** Short git commit hash injected at build time by vite.config.ts. */
declare const __APP_HASH__: string
/** Human-readable build timestamp, e.g. "11 May 22:15". */
declare const __APP_BUILT__: string
