/**
 * Editorial overrides for Medium articles, keyed by article id (slug from the Medium URL).
 * Articles without an entry fall back to their feed tags and excerpt.
 */
export interface ArticleNote {
  kicker: string;
  word: string;
  blurb: string;
  tags: string[];
}

export const articleNotes: Record<string, ArticleNote> = {
  'building-real-time-database-synchronization-with-rust-and-postgresql-listen-notify-0acc212b05a1': {
    kicker: 'Rust × PostgreSQL',
    word: 'LISTEN / NOTIFY',
    blurb: 'What I learned wiring Postgres notifications into a Rust service, so you can skip my mistakes.',
    tags: ['Rust', 'PostgreSQL', 'Real-time'],
  },
  'rest-apis-with-actix-web-in-rust-9557dab8aa5e': {
    kicker: 'Rust × HTTP',
    word: 'ACTIX WEB',
    blurb: 'My notes from building a first Rust API, written while it was still fresh and slightly painful.',
    tags: ['Rust', 'Actix', 'REST'],
  },
};
