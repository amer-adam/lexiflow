import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 4555,
    strictPort: true,
    allowedHosts: [
      'lexiflow.amerai.top',
      'test.amerai.top',
      'localhost',
    ]
  },
  preview: {
    host: true,
    port: 4555,
    strictPort: true,
  },
});
