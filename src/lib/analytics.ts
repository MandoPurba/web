import { site } from '@/config/site';

/** GA4 measurement ID from the environment; never hardcoded. */
const id = import.meta.env.PUBLIC_GA_ID?.trim();

/** A real measurement ID looks like `G-XXXXXXXXXX`; anything else is ignored, never inlined. */
const looksValid = !!id && /^G-[A-Z0-9]{4,}$/.test(id);

/**
 * Analytics ships only in production builds with a valid ID, so dev and preview never send hits.
 * When this is false, neither the GA snippet nor the consent banner is rendered at all.
 */
export const analyticsEnabled = import.meta.env.PROD && looksValid;

export const gaId = analyticsEnabled ? id! : null;

if (import.meta.env.PROD && id && !looksValid) {
  console.warn(`[analytics] PUBLIC_GA_ID "${id}" is not a G-XXXXXXXXXX measurement ID; analytics is disabled.`);
}

/** localStorage key holding the visitor's choice: 'granted' | 'denied'. */
export const consentKey = 'analytics-consent';

export const consent = {
  title: 'Cookies? Only the counting kind.',
  body: `Google Analytics, so ${site.name.split(' ')[0]} knows which pages people actually read. No ads, no profiles, no selling. Say no and nothing is stored.`,
  accept: 'Allow',
  decline: 'No thanks',
} as const;
