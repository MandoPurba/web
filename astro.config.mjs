// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const { SITE_URL, PUBLIC_GA_ID } = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

// Partytown ships only when analytics does, so pages without GA4 stay free of its runtime.
// Keep this test in sync with `src/lib/analytics.ts`.
const analytics =
  process.env.NODE_ENV === 'production' && /^G-[A-Z0-9]{4,}$/.test((PUBLIC_GA_ID ?? '').trim());

// https://astro.build/config
export default defineConfig({
  site: SITE_URL || 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'never',
  prefetch: true,
  image: {
    domains: ['miro.medium.com', 'cdn-images-1.medium.com'],
  },
  integrations: [
    react(),
    mdx(),
    sitemap(),
    // GA4 runs in a worker; `forward` lets the consent grant reach gtag inside it.
    ...(analytics ? [partytown({ config: { forward: ['dataLayer.push'] } })] : []),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
