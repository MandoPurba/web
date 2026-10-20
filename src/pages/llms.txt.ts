import type { APIRoute } from 'astro';
import { getArticles } from '@/lib/articles';
import { llmsTxt } from '@/lib/llms';
import { getProjects } from '@/lib/projects';

export const GET: APIRoute = async ({ site }) =>
  new Response(llmsTxt(await getProjects(), await getArticles(), site!), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
