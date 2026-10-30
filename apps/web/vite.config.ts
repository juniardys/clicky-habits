import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API paths proxied to the local API server in dev. The API serves at its
// root (no /api prefix): /auth/*, /health, /habits/*, /chat/*, /me/*.
const API_PREFIXES = ["/auth", "/health", "/habits", "/chat", "/me/"];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PREFIXES.map((prefix) => [
        prefix,
        { target: "http://localhost:3001", changeOrigin: false },
      ])
    ),
  },
});
