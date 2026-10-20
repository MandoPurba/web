// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  site: SITE_URL || 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'never',
  prefetch: true,
  image: {
    domains: ['miro.medium.com', 'cdn-images-1.medium.com'],
  },
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
