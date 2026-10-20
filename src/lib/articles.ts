import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

/** All Medium articles, newest first. */
export async function getArticles(): Promise<Article[]> {
  const entries = await getCollection('articles');
  return entries.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (date: Date) => dateFormat.format(date);

const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatMonth = (date: Date) => monthFormat.format(date);
