import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // im LAN erreichbar, z. B. fürs Tablet
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
