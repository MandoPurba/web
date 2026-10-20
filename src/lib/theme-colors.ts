/** Resolves design tokens (OKLCH CSS variables) to sRGB strings that THREE.Color understands. */
export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
}

const TOKENS: Record<keyof ThemeColors, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  accent: '--accent',
};

let ctx: CanvasRenderingContext2D | null = null;

function toRgb(value: string): string {
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return value;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [key, toRgb(style.getPropertyValue(token).trim())]),
  ) as unknown as ThemeColors;
}
