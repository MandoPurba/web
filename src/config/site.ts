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
  // Entries left as null are omitted from `sameAs` and from the links in the UI.
  social: {
    github: 'https://github.com/MandoPurba',
    linkedin: 'https://www.linkedin.com/in/romando-purba12',
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
  /**
   * Portrait for JSON-LD `Person.image`, as an absolute path in /public (e.g. '/romando.jpg').
   * null falls back to the hero photo (`src/assets/hero/front.*`), optimised at build time.
   */
  image: null as string | null,
  /** Bump when site content changes (no git history to read from). Shown as "Last updated". */
  updatedAt: '2026-10-20',
  /** 1200×630, same look as the hero. */
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
