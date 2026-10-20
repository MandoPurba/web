import { isoEdges, isoGrid, isoLayers, isoNodes, type IsoNode, type Layer } from '@/data/iso';

/** Static isometric SVG of the system graph (fallback for the Three.js scene). */
const C = Math.cos(Math.PI / 6);
const S = 48;
type Pt = [number, number];

const P = (x: number, y: number, z: number): Pt => [(x - y) * C * S, (x + y) * 0.5 * S - z * S];
const fmt = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function faces({ x, y, h }: IsoNode) {
  const w = 1;
  return {
    top: [P(x, y, h), P(x + w, y, h), P(x + w, y + w, h), P(x, y + w, h)],
    left: [P(x, y + w, h), P(x + w, y + w, h), P(x + w, y + w, 0), P(x, y + w, 0)],
    right: [P(x + w, y, h), P(x + w, y + w, h), P(x + w, y + w, 0), P(x + w, y, 0)],
  };
}

const labelPos = (n: IsoNode): Pt => {
  const t = P(n.x + 0.5, n.y + 0.5, n.h);
  return [t[0], t[1] - 0.5 * S - 12];
};

const fills: Record<Layer, string> = { api: 'var(--secondary)', queue: 'var(--accent)', db: 'var(--card)' };

export function isoSvg(active: Layer) {
  const points: Pt[] = [];
  for (const n of isoNodes) {
    const f = faces(n);
    points.push(...f.top, ...f.left, ...f.right);
    const l = labelPos(n);
    points.push([l[0] - 50, l[1] - 12], [l[0] + 50, l[1] + 4]);
  }
  const pad = 40;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const viewBox = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad]
    .map((v) => v.toFixed(1))
    .join(' ');

  const grid: [Pt, Pt][] = [];
  for (let i = Math.ceil(isoGrid.x0); i <= isoGrid.x1; i++) grid.push([P(i, isoGrid.y0, 0), P(i, isoGrid.y1, 0)]);
  for (let i = Math.ceil(isoGrid.y0); i <= isoGrid.y1; i++) grid.push([P(isoGrid.x0, i, 0), P(isoGrid.x1, i, 0)]);

  const byId = new Map(isoNodes.map((n) => [n.id, n]));
  const edges = isoEdges.map(([a, b]) => {
    const na = byId.get(a)!;
    const nb = byId.get(b)!;
    return `M${fmt(P(na.x + 0.5, na.y + 0.5, 0))} L${fmt(P(nb.x + 0.5, nb.y + 0.5, 0))}`;
  });

  const layers = isoLayers.map((l) => ({ id: l.id, label: l.label.toUpperCase(), at: P(l.x + 0.5, -1, 0) }));

  const nodes = [...isoNodes]
    .sort((a, b) => a.x + a.y - (b.x + b.y))
    .map((n) => {
      const f = faces(n);
      return {
        id: n.id,
        fill: n.layer === active ? 'var(--primary)' : fills[n.layer],
        top: f.top.map(fmt).join(' '),
        left: f.left.map(fmt).join(' '),
        right: f.right.map(fmt).join(' '),
        label: n.label.toUpperCase(),
        at: labelPos(n),
      };
    });

  return { viewBox, grid, edges, layers, nodes };
}
