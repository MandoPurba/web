import { site } from '@/config/site';

/** False when the site URL is unset or points to a local host (preview/temp builds). */
export function isIndexable(siteUrl: URL | undefined): siteUrl is URL {
  return !!siteUrl && !['localhost', '127.0.0.1'].includes(siteUrl.hostname);
}

/** Absolute URL for `path` on `siteUrl`, without a trailing slash (except the root). */
export function absoluteUrl(path: string, siteUrl: URL): string {
  const url = new URL(path, siteUrl);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

export const sameAs = Object.values(site.social).filter((url): url is string => !!url);

const OG_LOCALES: Record<string, string> = { en: 'en_US', id: 'id_ID' };
export const ogLocale = (lang: string) => OG_LOCALES[lang] ?? lang;
