import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { repositoryLastmodResolver, sitePathOf } from "../src/site/sitemap.ts";

const site = process.env.SITE_URL ?? "https://amattis96.github.io";
const base = (process.env.BASE_PATH ?? "/our-enemies-monitor").replace(/\/$/, "");

let lastmod: ReturnType<typeof repositoryLastmodResolver> | undefined;

// SITE_URL and BASE_PATH let mirrors deploy anywhere; defaults target the
// project's GitHub Pages site.
export default defineConfig({
  site,
  base: process.env.BASE_PATH ?? "/our-enemies-monitor",
  trailingSlash: "always",
  integrations: [
    react(),
    sitemap({
      // `lastmod` comes from Git and article dates, never from the wall clock.
      serialize(item) {
        lastmod ??= repositoryLastmodResolver();
        const date = lastmod(sitePathOf(item.url, site, base));
        return date ? { ...item, lastmod: date } : item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
