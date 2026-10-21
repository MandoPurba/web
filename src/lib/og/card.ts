import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori, { type SatoriOptions } from 'satori';
import { site } from '@/config/site';
import { palette } from './tokens';

export const OG_SIZE = { width: 1200, height: 630 } as const;

// satori lays out with content-box sizing: padding and border are added *outside* width/height,
// so the card's content box is the canvas minus its margin, border and padding on both sides.
// The hard shadow then falls inside the remaining margin.
const MARGIN = 40;
const BORDER = 8;
const PADDING = 48;
const SHADOW = 14;
const inset = (MARGIN + BORDER + PADDING) * 2;
const CARD = { width: OG_SIZE.width - inset, height: OG_SIZE.height - inset } as const;

/** Resolved from the project root so the build does not depend on where this chunk ends up. */
const require = createRequire(join(process.cwd(), 'package.json'));
// satori reads ttf/otf/woff; the @fontsource `.woff` files are the same faces the site serves.
const font = (specifier: string) => readFileSync(require.resolve(specifier));

const fonts: SatoriOptions['fonts'] = [
  {
    name: 'Space Grotesk',
    data: font('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff'),
    weight: 700,
    style: 'normal',
  },
  {
    name: 'JetBrains Mono',
    data: font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff'),
    weight: 700,
    style: 'normal',
  },
];

type Style = Record<string, unknown>;
type Node = { type: string; props: { style?: Style; children?: unknown } };

const el = (type: string, style: Style, children?: unknown): Node => ({ type, props: { style, children } });
// `width: 100%` keeps a long chip from stretching the whole card past its fixed width.
const row = (style: Style, children: unknown[]) =>
  el('div', { display: 'flex', alignItems: 'center', width: '100%', ...style }, children);

const mono = (text: string, style: Style = {}) =>
  el(
    'div',
    {
      display: 'flex',
      fontFamily: 'JetBrains Mono',
      fontSize: 26,
      letterSpacing: 1.6,
      color: palette.cardForeground,
      ...style,
    },
    text.toUpperCase(),
  );

/** Hard-bordered chip, the same shape as a Badge on the site. */
const chip = (text: string, background: string, foreground: string, style: Style = {}) =>
  mono(text, {
    background,
    color: foreground,
    border: `4px solid ${palette.border}`,
    padding: '10px 18px',
    lineHeight: 1.3,
    ...style,
  });

/** Title sizes down in steps so long project names stay on at most three lines. */
const titleSize = (title: string) => (title.length <= 24 ? 104 : title.length <= 40 ? 84 : 68);

export interface OgCard {
  /** Small line above the title, e.g. role and organisation. */
  kicker: string;
  title: string;
  /** Optional highlighted figure, e.g. "857K+ registrations". */
  metric?: string;
  /** Rendered as chips along the bottom. */
  tags?: string[];
}

export async function renderOgImage({ kicker, title, metric, tags = [] }: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(
    el(
      'div',
      {
        display: 'flex',
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.background,
        fontFamily: 'Space Grotesk',
      },
      [
        el(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            ...CARD,
            padding: PADDING,
            background: palette.card,
            border: `${BORDER}px solid ${palette.border}`,
            boxShadow: `${SHADOW}px ${SHADOW}px 0 0 ${palette.border}`,
          },
          [
            row({ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }, [
              chip(kicker, palette.primary, palette.primaryForeground, { flexShrink: 0 }),
              // A long `scale` line wraps inside its chip instead of widening the card.
              ...(metric
                ? [chip(metric, palette.accent, palette.accentForeground, { fontSize: 22, maxWidth: 560 })]
                : []),
            ]),
            el(
              'div',
              {
                display: 'flex',
                fontSize: titleSize(title),
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -3,
                color: palette.cardForeground,
              },
              title.toUpperCase(),
            ),
            row({ justifyContent: 'space-between', gap: 16 }, [
              row({ gap: 12, width: 'auto', flexShrink: 0 }, tags.slice(0, 3).map((tag) => chip(tag, palette.card, palette.cardForeground))),
              mono(`${site.name} · ${site.jobTitle}`, { fontSize: 22, color: palette.mutedForeground }),
            ]),
          ],
        ),
      ],
    ) as never,
    { ...OG_SIZE, fonts },
  );

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_SIZE.width } }).render().asPng();
  // Copied into a plain Uint8Array, not a Node Buffer, so it is a valid `Response` body.
  const bytes = new Uint8Array(png.byteLength);
  bytes.set(png);
  return bytes;
}
