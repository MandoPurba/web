import type { APIRoute } from 'astro';
import { getArticles } from '@/lib/articles';
import { llmsFullTxt } from '@/lib/llms';
import { getProjects } from '@/lib/projects';

export const GET: APIRoute = async ({ site }) =>
  new Response(llmsFullTxt(await getProjects(), await getArticles(), site!), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
