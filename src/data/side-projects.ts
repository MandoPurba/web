export interface SideProject {
  kind: string;
  topic: string;
  title: string;
  /** May contain `code` spans marked with backticks. */
  body: string;
  note: string;
  tags: string[];
  /** Medium article id of the write-up, if any. */
  articleId?: string;
  /** TODO: repository URL. null renders as TODO. */
  repo: string | null;
  tone: 'secondary' | 'accent';
}

export const sideProjects: SideProject[] = [
  {
    kind: 'Experiment',
    topic: 'Rust × PostgreSQL',
    title: 'Real-time sync with LISTEN/NOTIFY.',
    body: 'I wanted to see how far Postgres alone gets you for real-time database sync. A Rust listener picks up `NOTIFY` events and pushes changes out.',
    note: '// principle 01, tested on myself',
    tags: ['Rust', 'PostgreSQL', 'LISTEN/NOTIFY'],
    articleId: 'building-real-time-database-synchronization-with-rust-and-postgresql-listen-notify-0acc212b05a1',
    repo: null,
    tone: 'secondary',
  },
  {
    kind: 'Learning project',
    topic: 'Rust × HTTP',
    title: 'A REST API in Actix Web.',
    body: 'I picked up Rust by building a plain REST API with Actix Web: routing, extractors, error handling, and a lot of reading compiler messages.',
    note: '// borrow checker: 1, me: getting there',
    tags: ['Rust', 'Actix Web', 'REST'],
    articleId: 'rest-apis-with-actix-web-in-rust-9557dab8aa5e',
    repo: null,
    tone: 'accent',
  },
];
