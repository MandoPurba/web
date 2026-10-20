export type Tone = 'primary' | 'secondary' | 'accent' | 'card' | 'muted';

/** Surface + matching foreground for each brand tone. */
export const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
  card: 'bg-card text-card-foreground',
  muted: 'bg-muted text-foreground',
};
