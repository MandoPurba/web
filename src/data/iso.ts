/** System graph shown in the Work section: API → queue → database. Units are grid cells. */
export type Layer = 'api' | 'queue' | 'db';

export interface IsoNode {
  id: string;
  label: string;
  layer: Layer;
  x: number;
  y: number;
  /** Height in grid units. */
  h: number;
}

export const isoNodes: IsoNode[] = [
  { id: 'gw', label: 'Gateway', layer: 'api', x: 0, y: 0, h: 0.8 },
  { id: 'api', label: 'Booking API', layer: 'api', x: 0, y: 2.4, h: 1 },
  { id: 'myut', label: 'MyUT', layer: 'api', x: 0, y: 4.8, h: 1 },
  { id: 'q', label: 'Job queue', layer: 'queue', x: 2.8, y: 1.2, h: 0.6 },
  { id: 'wk', label: 'Go worker', layer: 'queue', x: 2.8, y: 3.6, h: 1 },
  { id: 'pg', label: 'Postgres', layer: 'db', x: 5.6, y: 1.8, h: 1.6 },
  { id: 'rd', label: 'Redis', layer: 'db', x: 5.6, y: 4.2, h: 0.7 },
];

export const isoEdges: [string, string][] = [
  ['gw', 'api'],
  ['gw', 'myut'],
  ['api', 'q'],
  ['q', 'wk'],
  ['wk', 'pg'],
  ['api', 'pg'],
  ['myut', 'rd'],
];

export const isoLayers: { id: Layer; x: number; label: string; tab: string; note: string }[] = [
  { id: 'api', x: 0, label: 'L1 · API', tab: 'L1 · API', note: 'L1 · API — where requests land. I keep handlers thin and idempotent.' },
  { id: 'queue', x: 2.8, label: 'L2 · Queue', tab: 'L2 · Queue', note: 'L2 · QUEUE — slow work goes here. Leased jobs, retries with backoff.' },
  { id: 'db', x: 5.6, label: 'L3 · Database', tab: 'L3 · DB', note: 'L3 · DATABASE — Postgres does the locking. SKIP LOCKED, not a mutex.' },
];

export const isoGrid = { x0: -1.5, x1: 7.5, y0: -1.5, y1: 6.8 };

/** Layers each work project lives in; highlighted in the background scene when its card is open in Fig.01. */
export const projectLayers: Record<string, Layer[]> = {
  'exam-seat-booking': ['api', 'db'],
  'graduation-screening-worker': ['queue'],
};
