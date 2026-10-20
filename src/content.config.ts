import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { site } from './config/site';
import { fetchMediumArticles } from './lib/medium/feed';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Used as the meta description. */
      summary: z.string().max(155),
      /** Defaults keep identity facts in `src/config/site.ts`. */
      org: z.string().default(site.worksFor.name),
      role: z.string().default(site.jobTitle),
      /** Shown as "Last updated" and used as `dateModified`. */
      updatedAt: z.coerce.date(),
      /** Key facts → Scale. Real numbers only. */
      scale: z.string().optional(),
      period: z.object({
        /** Optional: left out until the real start date is confirmed (renders as TODO). */
        start: z.coerce.date().optional(),
        /** No end = ongoing. */
        end: z.coerce.date().optional(),
      }),
      stack: z.array(z.string()),
      /** Real numbers only. */
      metrics: z.array(z.object({ label: z.string(), value: z.string() })),
      featured: z.boolean(),
      order: z.number(),
      status: z.enum(['shipped', 'in-progress']),
      cover: image().optional(),
      repo: z.url().optional(),
      draft: z.boolean().default(false),
      /** Homepage "Built at work" card. Projects without a teaser are not shown there. */
      teaser: z
        .object({
          /** Short label for the card strip, e.g. "Exam seat booking". */
          label: z.string(),
          part: z.string(),
          /** First-person headline. */
          headline: z.string(),
          /** May contain `code` spans marked with backticks. */
          body: z.string(),
          metric: z.object({ value: z.string(), label: z.string().optional() }),
          note: z.string(),
          tags: z.array(z.string()),
        })
        .optional(),
    }),
});

const articles = defineCollection({
  loader: {
    name: 'medium-rss',
    load: async ({ store, logger, parseData }) => {
      store.clear();
      const { username } = site.medium;
      if (!username) {
        logger.info('Medium username not set; skipping feed.');
        return;
      }

      try {
        const items = await fetchMediumArticles(username);
        for (const { id, ...item } of items) {
          const data = await parseData({ id, data: item });
          store.set({ id, data });
        }
        logger.info(`Loaded ${items.length} Medium article(s) for @${username}`);
      } catch (error) {
        store.clear();
        logger.warn(`Medium feed unavailable, rendering no articles: ${error instanceof Error ? error.message : error}`);
      }
    },
  },
  schema: z.object({
    title: z.string(),
    url: z.url(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()),
    /** Plain text only; full article HTML is never stored. */
    excerpt: z.string(),
    cover: z.url().optional(),
  }),
});

export const collections = { projects, articles };
