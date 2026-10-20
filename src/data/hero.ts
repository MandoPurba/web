import { site } from '@/config/site';

export const hero = {
  status: 'Open to backend roles',
  /** Headline lines; `mark` is drawn as a highlighted block. */
  lines: [
    { text: 'I make backend' },
    { text: 'systems', mark: { text: 'boring', tone: 'primary' } },
    { text: '— in a', mark: { text: 'good way.', tone: 'secondary' } },
  ],
  lede: "I care about the parts nobody demos: queues that don't drop jobs, writes that don't collide, and logs that make sense at 2 a.m.",
  primaryCta: { label: 'See what I built →', href: '#work' },
  secondaryCta: { label: 'Say hi', href: '#contact' },
  note: '← start here',
  photo: {
    // TODO: add the portrait (4:5) and import it here.
    caption: ['IMG_0001.JPG', '// me, mid-deploy'],
    sticker: `hi, I'm ${site.name.split(' ')[0]}`,
    tag: `${site.location.timezone} · ${site.location.locality.split(',')[0]}`,
  },
  facts: [
    { label: 'I write', value: 'Go, TypeScript (NestJS), SQL. Rust after hours.' },
    { label: 'I live', value: `${site.location.locality}, ${site.location.countryName}` },
    { label: 'Day job', value: 'Backend dev since Nov 2022', aside: `@ ${site.worksFor.name}` },
  ],
  marquee: ['Go', 'NestJS', 'PostgreSQL', 'Redis', 'Job queues', 'Distributed systems'],
} as const;
