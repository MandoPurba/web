import { site } from '@/config/site';

export interface Lesson {
  title: string;
  /** May contain `code` spans marked with backticks. */
  body: string;
}

export interface Experience {
  role: string;
  org: string;
  period: { start: string; end: string | null; label: string };
  summary: string;
  lessons: Lesson[];
}

export const experience: Experience[] = [
  {
    role: site.jobTitle,
    org: `${site.worksFor.department}, ${site.worksFor.name}`,
    period: { start: '2022-11', end: null, label: 'Nov 2022 → Now' },
    summary: 'My first backend job, and where most of my opinions came from.',
    lessons: [
      {
        title: 'Contention is a design problem',
        body: 'I built the exam seat booking flow on PostgreSQL `SKIP LOCKED` with 2-hour holds. It handled 857K+ registrations.',
      },
      {
        title: "Workers die; jobs shouldn't",
        body: 'I wrote the graduation screening worker in Go: leased jobs on a Postgres queue, retries with backoff.',
      },
      {
        title: 'Scale is mostly care',
        body: 'I maintain backend services for MyUT, the student portal used by 800K+ students.',
      },
      {
        title: 'Migrate in slices',
        body: 'I moved legacy Laravel services to NestJS and Go within my first year, one piece at a time.',
      },
    ],
  },
];
