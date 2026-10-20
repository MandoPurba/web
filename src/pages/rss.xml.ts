import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { getArticles } from '@/lib/articles';
import { getProjects } from '@/lib/projects';

/** Case studies on this site + article links that point to Medium (canonical stays there). */
export const GET: APIRoute = async (context) => {
  const projects = (await getProjects()).map((project) => ({
    title: project.data.title,
    link: `/work/${project.id}`,
    description: project.data.summary,
    pubDate: project.data.period.start ?? project.data.updatedAt,
    categories: ['Case study', ...project.data.stack],
  }));
  const articles = (await getArticles()).map(({ data }) => ({
    title: data.title,
    link: data.url,
    description: data.excerpt,
    pubDate: data.publishedAt,
    categories: ['Article', ...data.tags],
  }));
  return rss({
    title: `${site.name} — ${site.jobTitle}`,
    description: site.description,
    site: context.site!,
    items: [...projects, ...articles].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()),
    customData: `<language>${site.locale}</language>`,
    trailingSlash: false,
  });
};
