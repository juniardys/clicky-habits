// Public base URL of the API, baked into the bundle at build time.
// - Dev: leave VITE_API_URL empty; the Vite dev server proxies API paths to :3001.
// - Prod: VITE_API_URL="https://api.clickyhabits.com" (required)
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// Public Google OAuth client ID (same value as GOOGLE_CLIENT_ID on the API),
// baked into the bundle at build time. Only used by Google One Tap on the
// login page; empty disables the One Tap prompt (the regular Google button
// still works, it does not need the ID in the browser).
export function parseGoogleClientId(value: string | undefined): string {
  return (value ?? "").trim();
}

export const GOOGLE_CLIENT_ID = parseGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
