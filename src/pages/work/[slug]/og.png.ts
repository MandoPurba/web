import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgImage } from '@/lib/og/card';
import { getProjects, type Project } from '@/lib/projects';

/** One OG image per case study, rendered at build time to /work/<slug>/og.png. */
export const getStaticPaths = (async () => {
  const projects = await getProjects();
  return projects.map((project) => ({ params: { slug: project.id }, props: { project } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { data } = props.project as Project;
  const metric = data.scale ?? (data.metrics[0] && `${data.metrics[0].value} ${data.metrics[0].label}`);

  const png = await renderOgImage({
    kicker: data.org,
    title: data.title,
    metric: metric || undefined,
    tags: data.stack,
  });

  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
