import type { APIRoute, GetStaticPaths } from 'astro';
import { projectMarkdown } from '@/lib/llms';
import { getProjects, type Project } from '@/lib/projects';

export const getStaticPaths = (async () =>
  (await getProjects()).map((project) => ({ params: { slug: project.id }, props: { project } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ project: Project }> = ({ props, site }) =>
  new Response(projectMarkdown(props.project, site!) + '\n', {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
