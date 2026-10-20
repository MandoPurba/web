const mediumUsername: string = 'romando.purba125';
const hasMedium = mediumUsername.trim() !== '' && mediumUsername !== 'TODO';

export const site = {
  name: 'Romando Purba',
  jobTitle: 'Backend Developer',
  description:
    'Romando Purba is a backend developer building Go and NestJS services on PostgreSQL for a national university platform serving 800K+ students.',
  location: {
    locality: 'Pamulang, South Tangerang',
    region: 'Banten',
    country: 'ID',
    countryName: 'Indonesia',
    timezone: 'UTC+7',
  },
  /** Main stack, in the order it should be named in prose. */
  stack: ['Go', 'NestJS', 'PostgreSQL'],
  /** BCP 47 codes + English names. */
  languages: [
    { code: 'id', name: 'Indonesian' },
    { code: 'en', name: 'English' },
  ],
  headline:
    'Go, NestJS and PostgreSQL services for a national university platform serving 800K+ students.',
  email: 'prb.romando@gmail.com',
  // TODO: replace with real profile URLs. Entries left as null are omitted from output.
  social: {
    github: null as string | null,
    linkedin: null as string | null,
    medium: hasMedium ? `https://medium.com/@${mediumUsername}` : null,
  },
  /** Set username to 'TODO' or '' to disable the Medium feed. */
  medium: { username: hasMedium ? mediumUsername : null },
  knowsAbout: [
    'Go',
    'TypeScript',
    'NestJS',
    'PostgreSQL',
    'Redis',
    'Distributed Systems',
    'Job Queues',
  ],
  worksFor: {
    name: 'Universitas Terbuka',
    url: 'https://www.ut.ac.id',
    department: 'Directorate of Digital Technology (DTD)',
  },
  /** TODO: absolute-path portrait (e.g. '/romando.jpg'); null keeps `image` out of JSON-LD. */
  image: null as string | null,
  /** Bump when site content changes (no git history to read from). Shown as "Last updated". */
  updatedAt: '2026-10-20',
  // TODO: add public/og-default.png (1200×630).
  defaultOgImage: '/og-default.png',
  // Mirrors --background (light/dark) in global.css; <meta name="theme-color"> can't read CSS variables.
  themeColor: {
    light: 'oklch(0.982 0.022 89.8)',
    dark: 'oklch(0.17 0.008 90)',
  },
  locale: 'en',
  alternateLocale: 'id',
} as const;

export type Site = typeof site;

export const socialLinks = [
  { label: 'GitHub', url: site.social.github },
  { label: 'LinkedIn', url: site.social.linkedin },
  { label: 'Medium', url: site.social.medium },
] as const;
