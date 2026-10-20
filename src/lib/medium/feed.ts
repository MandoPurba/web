import { XMLParser } from 'fast-xml-parser';

export interface MediumArticle {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  tags: string[];
  excerpt: string;
  cover?: string;
}

const FEED_TIMEOUT_MS = 10_000;
const EXCERPT_LENGTH = 200;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Plain-text excerpt: drops figures and headings, strips tags, cuts at a word boundary. */
function toExcerpt(html: string): string {
  const text = decodeEntities(
    html
      .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
      .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH + 1);
  const boundary = cut.lastIndexOf(' ');
  return `${cut.slice(0, boundary > 0 ? boundary : EXCERPT_LENGTH).replace(/[\s.,;:!?—–-]+$/, '')}…`;
}

/** First real image: skips Medium's `/_/stat` tracking pixel and 1×1 images. */
function firstImage(html: string): string | undefined {
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    if (!src || src.includes('medium.com/_/stat')) continue;
    if (/\swidth="1"/i.test(tag) && /\sheight="1"/i.test(tag)) continue;
    return decodeEntities(src);
  }
  return undefined;
}

function cleanUrl(link: string): string {
  const url = new URL(link);
  for (const key of [...url.searchParams.keys()]) {
    if (key === 'source' || key.startsWith('utm_') || key === 'sk') url.searchParams.delete(key);
  }
  url.hash = '';
  return url.href;
}

const toArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export async function fetchMediumArticles(username: string): Promise<MediumArticle[]> {
  const response = await fetch(`https://medium.com/feed/@${username}`, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });
  const feed = parser.parse(await response.text());
  const items = toArray<Record<string, unknown>>(feed?.rss?.channel?.item);

  return items
    .map((item): MediumArticle => {
      const url = cleanUrl(String(item.link));
      const html = String(item['content:encoded'] ?? '');
      return {
        id: new URL(url).pathname.split('/').filter(Boolean).at(-1)!,
        title: decodeEntities(String(item.title)).trim(),
        url,
        publishedAt: new Date(String(item.pubDate)),
        tags: toArray(item.category).map(String),
        excerpt: toExcerpt(html),
        cover: firstImage(html),
      };
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
