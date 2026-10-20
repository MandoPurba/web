import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

export const statusLabels: Record<Project['data']['status'], string> = {
  shipped: 'Shipped',
  'in-progress': 'In progress',
};

/** All projects sorted by `order`. Drafts are included in dev only. */
export async function getProjects(): Promise<Project[]> {
  const entries = await getCollection('projects', ({ data }) => !import.meta.env.PROD || !data.draft);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatPeriod({ start, end }: Project['data']['period']): string {
  if (!start) return 'TODO';
  return `${monthYear.format(start)} – ${end ? monthYear.format(end) : 'Present'}`;
}
