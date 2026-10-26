import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// SITE_URL and BASE_PATH let mirrors deploy anywhere; defaults target the
// project's GitHub Pages site.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://amattis96.github.io",
  base: process.env.BASE_PATH ?? "/our-enemies-monitor",
  trailingSlash: "always",
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
