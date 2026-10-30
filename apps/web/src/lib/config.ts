// Public base URL of the API, baked into the bundle at build time.
// - Dev: leave VITE_API_URL empty; the Vite dev server proxies /api to :3001.
// - Prod (subdomain setup): VITE_API_URL="https://api.clickyhabits.com"
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
