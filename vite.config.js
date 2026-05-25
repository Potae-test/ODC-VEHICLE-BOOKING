import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "firebase-messaging-sw.js",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      includeAssets: [
        "favicon.svg",
        "icons.svg",
        "icon-192.png",
        "icon-512.png",
        "manifest.webmanifest",
        "offline.html",
      ],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
