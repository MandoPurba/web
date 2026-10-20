import { site, socialLinks } from '@/config/site';
import { experience } from '@/data/experience';
import { education, credentials } from '@/data/education';
import { skills } from '@/data/skills';
import { hero } from '@/data/hero';
import { formatDate, type Article } from '@/lib/articles';
import { formatPeriod, statusLabels, type Project } from '@/lib/projects';

/** One-line, entity-rich self-introduction (also shown as the homepage TL;DR). */
export const tldr = `I'm ${site.name}, a ${site.jobTitle} in ${site.location.locality}, ${site.location.countryName}, working with ${listOf(site.stack)}.`;

function listOf(items: readonly string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Factual bullets about the owner, composed from config + data only. */
export function aboutBullets(): string[] {
  const job = experience[0];
  const studying = education.find((e) => e.expected);
  return [
    `${site.jobTitle} at the ${site.worksFor.department}, ${site.worksFor.name}${job ? ` (${job.period.label.replace('→', '–')})` : ''}.`,
    `Builds ${site.headline}`,
    `Main stack: ${listOf(site.stack)}; also ${[...site.knowsAbout].filter((k) => !site.stack.includes(k as never)).join(', ')}.`,
    `Based in ${site.location.locality}, ${site.location.countryName} (${site.location.timezone}).`,
    ...(studying ? [`Studying ${studying.program} at ${studying.institution} (${studying.period}, expected).`] : []),
  ];
}

/** Strips MDX-only syntax (imports, exports, components) so only Markdown remains. */
export function mdxToMarkdown(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/<([A-Z][\w.]*)\b[^>]*\/>/g, '')
    .replace(/<([A-Z][\w.]*)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Shifts Markdown headings down by `levels` so a document can be nested. */
const nest = (markdown: string, levels: number) => markdown.replace(/^(#{1,6}) /gm, (_, h: string) => `${'#'.repeat(Math.min(6, h.length + levels))} `);

export function keyFacts(project: Project) {
  const { data } = project;
  return [
    { label: 'Role', value: data.role },
    { label: 'Organisation', value: data.org },
    { label: 'Period', value: formatPeriod(data.period) },
    { label: 'Stack', value: data.stack.length > 0 ? data.stack.join(', ') : 'TODO' },
    { label: 'Scale', value: data.scale ?? data.metrics.map((m) => `${m.value} ${m.label}`).join(', ') ?? 'TODO' },
    { label: 'Status', value: statusLabels[data.status] },
  ].map((fact) => ({ ...fact, value: fact.value || 'TODO' }));
}

/** Full Markdown for one case study. `depth` = heading level of its title. */
export function projectMarkdown(project: Project, siteUrl: URL, depth = 1): string {
  const { data } = project;
  const url = new URL(`/work/${project.id}`, siteUrl).href;
  const facts = keyFacts(project)
    .map((fact) => `- ${fact.label}: ${fact.value}`)
    .join('\n');
  return [
    `${'#'.repeat(depth)} ${data.title}`,
    `> ${data.summary}`,
    `URL: ${url}\nAuthor: ${site.name}\nLast updated: ${day(data.updatedAt)}`,
    `${'#'.repeat(depth + 1)} Key facts\n\n${facts}`,
    nest(mdxToMarkdown(project.body ?? ''), depth - 1),
  ].join('\n\n');
}

const links = () => [
  ...socialLinks.flatMap(({ label, url }) => (url ? [`- [${label}](${url})`] : [])),
  `- [Email](mailto:${site.email})`,
];

/** https://llmstxt.org — short index for LLMs. */
export function llmsTxt(projects: Project[], articles: Article[], siteUrl: URL): string {
  return [
    `# ${site.name}`,
    `> ${tldr}`,
    `## About\n\n${aboutBullets().map((b) => `- ${b}`).join('\n')}`,
    `## Work\n\n${projects.map((p) => `- [${p.data.title}](${new URL(`/work/${p.id}.md`, siteUrl).href}): ${p.data.summary}`).join('\n')}`,
    `## Writing\n\n${articles.length > 0 ? articles.map((a) => `- [${a.data.title}](${a.data.url}): ${formatDate(a.data.publishedAt)}`).join('\n') : '- Articles coming soon.'}`,
    `## Links\n\n${links().join('\n')}`,
    `## Optional\n\n- [Full text](${new URL('/llms-full.txt', siteUrl).href}): bio, experience, skills, education and every case study.`,
  ].join('\n\n') + '\n';
}

/** Everything in one plain Markdown file: bio, experience, skills, education, case studies. */
export function llmsFullTxt(projects: Project[], articles: Article[], siteUrl: URL): string {
  const job = experience.map((e) =>
    [
      `### ${e.role} — ${e.org}`,
      `${e.period.label.replace('→', '–')}. ${e.summary}`,
      e.lessons.map((l) => `- ${l.title}: ${l.body}`).join('\n'),
    ].join('\n\n'),
  );
  return [
    `# ${site.name}`,
    `> ${tldr}`,
    `${hero.lede}`,
    `## About\n\n${aboutBullets().map((b) => `- ${b}`).join('\n')}`,
    `## Experience\n\n${job.join('\n\n')}`,
    `## Skills\n\n${skills.map((g) => `- ${g.category}: ${g.items.join(', ')}`).join('\n')}`,
    `## Education\n\n${education.map((e) => `- ${e.program}, ${e.institution} (${e.period}${e.expected ? ', expected' : ''})`).join('\n')}`,
    `## Certifications\n\n${credentials.map((c) => `- ${c.name} (${c.issuer})`).join('\n')}`,
    `## Case studies\n\n${projects.map((p) => projectMarkdown(p, siteUrl, 3)).join('\n\n---\n\n')}`,
    `## Writing\n\n${articles.length > 0 ? articles.map((a) => `- ${a.data.title} (${formatDate(a.data.publishedAt)}): ${a.data.url}`).join('\n') : '- Articles coming soon.'}`,
    `## Links\n\n${links().join('\n')}`,
  ].join('\n\n') + '\n';
}
