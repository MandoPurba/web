import globalCss from '@/styles/global.css?raw';

/**
 * OG images are rendered at build time, outside any browser, so they cannot read CSS variables.
 * Instead the light-mode `:root` block of global.css is parsed here and converted to sRGB hex,
 * which keeps global.css the only place colors are defined (see the color rules in CLAUDE.md).
 */
function rootTokens(css: string): Map<string, string> {
  const start = css.indexOf(':root {');
  const end = css.indexOf('\n}', start);
  if (start === -1 || end === -1) throw new Error('og/tokens: no `:root` block found in global.css');
  const tokens = new Map<string, string>();
  for (const [, name, value] of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

const gamma = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

const hex = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/** `oklch(L C H)` → `#rrggbb` (OKLab → linear sRGB → gamma-encoded sRGB). */
export function oklchToHex(value: string): string {
  const match = value.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) throw new Error(`og/tokens: cannot read "${value}" as oklch()`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

const tokens = rootTokens(globalCss);

/** Hex value of a `--token` from `:root`. */
export function color(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`og/tokens: --${name} is not defined in :root`);
  return oklchToHex(value);
}

export const palette = {
  background: color('background'),
  foreground: color('foreground'),
  card: color('card'),
  cardForeground: color('card-foreground'),
  primary: color('primary'),
  primaryForeground: color('primary-foreground'),
  accent: color('accent'),
  accentForeground: color('accent-foreground'),
  mutedForeground: color('muted-foreground'),
  border: color('border'),
} as const;
