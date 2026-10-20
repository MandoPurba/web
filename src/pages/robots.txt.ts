import type { APIRoute } from 'astro';
import { isIndexable } from '@/lib/seo';

/** Search and AI crawlers that are explicitly welcome (training, search and user-triggered fetches). */
const BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
];

export const GET: APIRoute = ({ site }) => {
  const body = isIndexable(site)
    ? [
        `# LLM-readable summary: ${new URL('llms.txt', site).href}`,
        `# Full text for LLMs: ${new URL('llms-full.txt', site).href}`,
        `# Sitemap: ${new URL('sitemap-index.xml', site).href}`,
        '',
        'User-agent: *',
        'Allow: /',
        '',
        ...BOTS.flatMap((bot) => [`User-agent: ${bot}`, 'Allow: /', '']),
        `Sitemap: ${new URL('sitemap-index.xml', site).href}`,
        '',
      ].join('\n')
    : ['# Preview build: not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
