// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    integrations: [react()],
    env: {
        schema: {
            // The Teammate Portal the live pages read from:
            // GET <PUBLIC_PORTAL_URL>/api/public/progress (/progress),
            // /api/public/events (/events) and /api/public/sponsors plus its
            // logos (the band on /sponsors). Override in .env to point a
            // local build at a local portal.
            PUBLIC_PORTAL_URL: envField.string({
                context: "client",
                access: "public",
                url: true,
                default: "https://communication-portal-iota.vercel.app",
            }),
        },
    },
    fonts: [
        {
            provider: fontProviders.fontsource(),
            name: "Jockey One",
            cssVariable: "--font-jockey-one-astro",
        },
        {
            provider: fontProviders.google(),
            name: "Inter",
            cssVariable: "--font-inter-astro",
            weights: ["100 900"],
        },
        {
            provider: fontProviders.fontsource(),
            name: "Geist Mono",
            cssVariable: "--font-geist-mono-astro",
            weights: ["400 700"],
            // Ends with the generic family, so the metric-matched fallback is a monospace one (not Arial).
            fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        },
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});
