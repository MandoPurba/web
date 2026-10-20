export interface Principle {
  title: string;
  /** May contain `code` spans marked with backticks. */
  body: string;
  note: string;
  tone: 'primary' | 'accent' | 'secondary' | 'card';
}

export const principles: Principle[] = [
  {
    title: 'Postgres is usually enough.',
    body: 'Before I add a broker or a cache, I check whether `SKIP LOCKED`, `LISTEN/NOTIFY` or one good index already solves it.',
    note: '// one less thing to page me',
    tone: 'primary',
  },
  {
    title: 'Fewer moving parts.',
    body: 'Every new service is something to deploy, watch and debug. I add one when the problem demands it, not before.',
    note: '// boring is a feature',
    tone: 'accent',
  },
  {
    title: 'Logs I can actually read.',
    body: "Structured, with request IDs, written for whoever is on call. Usually that's me.",
    note: '// future me says thanks',
    tone: 'secondary',
  },
  {
    title: 'Idempotent by default.',
    body: 'Retries will happen. Jobs and endpoints I write are safe to run twice.',
    note: '// run it again. nothing breaks.',
    tone: 'card',
  },
];
