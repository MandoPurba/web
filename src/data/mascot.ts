/**
 * The mascot: a cat with a box head whose front is a screen. Its face is a 16×10 pixel grid.
 * Legend: `#` primary (yellow) · `w` white · `r` destructive (red) · `.` off.
 */
export type Face =
  | 'idle'
  | 'blink'
  | 'curious'
  | 'happy'
  | 'wink'
  | 'love'
  | 'surprised'
  | 'typing'
  | 'reading'
  | 'excited'
  | 'angry'
  | 'annoyed'
  | 'sleepy'
  | 'asleep'
  | 'dizzy';

export const FACE_COLS = 16;
export const FACE_ROWS = 10;

const MOUTH = ['................', '.......##.......', '.....#.##.#.....', '......#..#......', '................'];

export const faces: Record<Face, string[]> = {
  idle: ['................', '................', '...##......##...', '...##......##...', '...##......##...', ...MOUTH],
  blink: ['................', '................', '................', '................', '...##......##...', ...MOUTH],
  curious: ['................', '..###......###..', '..#w#......#w#..', '..###......###..', '..###......###..', '................', '.......##.......', '......####......', '......#..#......', '......####......'],
  happy: ['................', '................', '....#......#....', '...#.#....#.#...', '................', '.rr..........rr.', ...MOUTH.slice(1)],
  wink: ['................', '................', '....#......##...', '...#.#.....##...', '...........##...', ...MOUTH],
  love: ['................', '..#.#......#.#..', '.#####....#####.', '..###......###..', '...#........#...', ...MOUTH],
  surprised: ['................', '..###......###..', '..###......###..', '..###......###..', '................', '................', '......####......', '......#..#......', '......####......', '................'],
  typing: ['................', '................', '................', '...##......##...', '...##......##...', '................', '.......##.......', '................', '..#######.......', '................'],
  reading: ['................', '..wwww....wwww..', '..w##wwwwww##w..', '..w##w....w##w..', '..wwww....wwww..', '................', ...MOUTH.slice(1)],
  excited: ['................', '..#..........#..', '...#........#...', '..#..........#..', '................', '................', '......####......', '......#..#......', '.......##.......', '................'],
  annoyed: ['................', '................', '..####....####..', '...##......##...', '...##......##...', '................', '................', '.....######.....', '................', '................'],
  angry: ['................', '..rr........rr..', '....rr....rr....', '...###....###...', '...###....###...', '................', '................', '......####......', '.....#....#.....', '................'],
  sleepy: ['................', '................', '................', '................', '...###....###...', '................', '.......##.......', '................', '................', '................'],
  asleep: ['...........###..', '............#...', '...........###..', '................', '................', '...###....###...', '................', '.......##.......', '................', '................'],
  dizzy: ['................', '..r.r......r.r..', '...r........r...', '..r.r......r.r..', '................', '................', '................', '......####......', '................', '................'],
};

/** Faces whose eyes follow the cursor (the whole face shifts a pixel). */
export const lookingFaces = new Set<Face>(['idle', 'blink', 'curious', 'typing']);

/**
 * Tour guide: hover anything for a while and the cat says what it is. An element's own `data-hint`
 * (and `data-hint-dark` in dark mode) wins; these cover the rest, picked from the link or button.
 */
export const hints = {
  section: (title: string) => `jumps to “${title}”`,
  top: 'back to the top',
  home: 'back to the homepage',
  otherPage: (title: string) => `the homepage, at “${title}”`,
  caseStudy: 'the full case study: the why and the how',
  writing: 'everything I wrote, in one place',
  /** Said again while the cursor stays put, and finally it clicks it itself (or refuses to, for links that leave the page). */
  nudge: 'still here? it’s clickable, you know.',
  poke: 'ugh. fine, I’ll click it.',
  refuse: 'ugh. that one’s yours to click.',
  /** Grumbled up close after it clicked for you. */
  scold: [
    'look… this one can be clicked.',
    'see? it clicks. not that hard.',
    'it’s a button. buttons get clicked.',
    'next time, click it yourself, ok?',
  ],
  mail: 'my inbox. I reply, promise.',
  rss: 'RSS feed, for robots and nerds',
  llms: 'this site, written for AI assistants',
  external: {
    'github.com': 'my GitHub. the code lives there.',
    'linkedin.com': 'LinkedIn: the formal me',
    'medium.com': 'my Medium. I write things down there.',
  } as Record<string, string>,
  anyExternal: (host: string) => `opens ${host} in a new tab`,
};
