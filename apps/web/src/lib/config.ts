// Public base URL of the API, baked into the bundle at build time.
// - Dev: leave VITE_API_URL empty; the Vite dev server proxies API paths to :3001.
// - Prod: VITE_API_URL="https://api.clickyhabits.com" (required)
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
