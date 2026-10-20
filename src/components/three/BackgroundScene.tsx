import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import { isoEdges, isoNodes, projectLayers, type IsoNode } from '@/data/iso';
import { readThemeColors, type ThemeColors } from '@/lib/theme-colors';

/**
 * Decorative "backend system" behind the homepage. Each chapter has an empty DOM slot
 * (`[data-scene-anchor]`); every frame the graph is laid out for the slots around the viewport
 * and morphs between them as you scroll:
 *   hero       — services orbit the photo, packets flow into it, cubes turn slowly, hover lights a node
 *   how        — zoomed out: the whole graph
 *   work       — the graph again; layers of the project open in Fig.01 turn yellow
 *   experience — nodes stack vertically beside the timeline
 *   contact    — everything collapses into one cube beside the headline
 */

type Kind = 'hero' | 'how' | 'work' | 'experience' | 'contact';
const KINDS: Kind[] = ['hero', 'how', 'work', 'experience', 'contact'];

/** Pixels per world unit (orthographic zoom). */
const ZOOM = 40;
const VIEW = new THREE.Vector3(1, 1, 1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(-1, 2, -1).normalize();
/** Screen height of one world unit of vertical (Y) extent. */
const RISE = 2 / Math.sqrt(6);
/** Anchors smaller than this (hidden or collapsed at this breakpoint) are skipped. */
const MIN_ANCHOR = 80;
const PACKET = 0.26;
const N = isoNodes.length;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

interface Layout {
  pos: THREE.Vector3[];
  scale: THREE.Vector3[];
}
const makeLayout = (): Layout => ({
  pos: isoNodes.map(() => new THREE.Vector3()),
  scale: isoNodes.map(() => new THREE.Vector3(1, 1, 1)),
});

/** The system graph, centred on its projected bounding box. */
const GRAPH = (() => {
  const xs = isoNodes.map((n) => n.x);
  const ys = isoNodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
  const cz = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  const base = isoNodes.map((n) => new THREE.Vector3(n.x + 0.5 - cx, 0, n.y + 0.5 - cz));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const p = new THREE.Vector3();
  isoNodes.forEach((n, i) => {
    for (const [dx, dy, dz] of [[-0.5, 0, -0.5], [0.5, 0, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [-0.5, n.h, -0.5], [0.5, n.h, 0.5]]) {
      p.copy(base[i]!).add(new THREE.Vector3(dx, dy, dz));
      x0 = Math.min(x0, p.dot(RIGHT)); x1 = Math.max(x1, p.dot(RIGHT));
      y0 = Math.min(y0, p.dot(UP)); y1 = Math.max(y1, p.dot(UP));
    }
  });
  const center = RIGHT.clone().multiplyScalar((x0 + x1) / 2).addScaledVector(UP, (y0 + y1) / 2);
  return { base, center, w: x1 - x0, h: y1 - y0 };
})();

const layouts: Record<Kind, (rect: DOMRect, out: Layout) => void> = {
  hero(rect, out) {
    // Services sit on an ellipse just outside the photo frame.
    const rx = rect.width / 2 + 44;
    const ry = rect.height / 2 + 36;
    const s = 0.55;
    isoNodes.forEach((n, i) => {
      const a = -Math.PI * 0.8 + (i / N) * Math.PI * 2;
      out.pos[i]!.copy(RIGHT).multiplyScalar((Math.cos(a) * rx) / ZOOM).addScaledVector(UP, (Math.sin(a) * ry) / ZOOM);
      out.pos[i]!.y -= (n.h * s) / 2;
      out.scale[i]!.setScalar(s);
    });
  },
  how: (rect, out) => graph(rect, out),
  work: (rect, out) => graph(rect, out),
  experience(rect, out) {
    // Plates stacked like the timeline next to them.
    const gap = 0.72;
    const plate = 0.42;
    const span = (N - 1) * gap + plate;
    const s = clamp(Math.min((rect.height * 0.85) / ZOOM / (span * RISE + 1.14), (rect.width * 0.85) / ZOOM / 1.98), 0, 1.3);
    isoNodes.forEach((n, i) => {
      out.pos[i]!.set(0, ((N - 1 - i) * gap - span / 2) * s, 0);
      out.scale[i]!.set(1.4 * s, (plate * s) / n.h, 1.4 * s);
    });
  },
  contact(rect, out) {
    // One cube: the first node grows, the rest fold into it.
    const c = Math.min((rect.width * 0.7) / ZOOM / 1.414, (rect.height * 0.7) / ZOOM / 1.63);
    isoNodes.forEach((n, i) => {
      out.pos[i]!.set(0, -c / 2, 0);
      if (i === 0) out.scale[i]!.set(c, c / n.h, c);
      else out.scale[i]!.setScalar(0.0001);
    });
  },
};

function graph(rect: DOMRect, out: Layout) {
  const s = clamp(Math.min((rect.width * 0.92) / ZOOM / GRAPH.w, (rect.height * 0.92) / ZOOM / GRAPH.h), 0, 1.1);
  isoNodes.forEach((_, i) => {
    out.pos[i]!.copy(GRAPH.base[i]!).sub(GRAPH.center).multiplyScalar(s);
    out.scale[i]!.setScalar(s);
  });
}

/** World point (on the camera plane through the origin) that projects onto the rect's centre. */
function anchorCenter(rect: DOMRect, vw: number, vh: number, out: THREE.Vector3) {
  const dx = rect.left + rect.width / 2 - vw / 2;
  const dy = vh / 2 - (rect.top + rect.height / 2);
  return out.copy(RIGHT).multiplyScalar(dx / ZOOM).addScaledVector(UP, dy / ZOOM);
}

function edgePoints(geometry: THREE.BufferGeometry): [number, number, number][] {
  const array = new THREE.EdgesGeometry(geometry).attributes.position!.array;
  const points: [number, number, number][] = [];
  for (let i = 0; i < array.length; i += 3) points.push([array[i]!, array[i + 1]!, array[i + 2]!]);
  geometry.dispose();
  return points;
}

interface Shared {
  reduced: boolean;
  view: string;
  hover: string | null;
  pings: Map<string, number>;
}

interface NodeHandles {
  group: THREE.Group | null;
  materials: THREE.MeshBasicMaterial[];
}

function Node({ node, colors, handles, shared }: { node: IsoNode; colors: ThemeColors; handles: NodeHandles; shared: RefObject<Shared> }) {
  const base = node.layer === 'api' ? colors.secondary : node.layer === 'queue' ? colors.accent : colors.card;
  const materials = useMemo(
    () => [colors.primaryForeground, base, base, base, base, base].map((c) => new THREE.MeshBasicMaterial({ color: c })),
    [colors, base],
  );
  const outline = useMemo(() => edgePoints(new THREE.BoxGeometry(1, node.h, 1)), [node.h]);
  handles.materials = materials;
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return (
    <group ref={(g) => void (handles.group = g)}>
      <mesh
        position-y={node.h / 2}
        material={materials}
        onPointerOver={() => void (shared.current.hover = node.id)}
        onPointerOut={() => {
          if (shared.current.hover === node.id) shared.current.hover = null;
        }}
      >
        <boxGeometry args={[1, node.h, 1]} />
      </mesh>
      <group position-y={node.h / 2}>
        <Line points={outline} segments color={colors.foreground} lineWidth={2.5} />
      </group>
    </group>
  );
}

const PACKET_OUTLINE = edgePoints(new THREE.BoxGeometry(1, 1, 1));

function Director({ colors, shared }: { colors: ThemeColors; shared: RefObject<Shared> }) {
  const { size } = useThree();
  const anchors = useMemo(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-scene-anchor]')).filter((el) =>
        KINDS.includes(el.dataset.sceneAnchor as Kind),
      ),
    [],
  );
  const nodes = useMemo<NodeHandles[]>(() => isoNodes.map(() => ({ group: null, materials: [] })), []);
  const packets = useRef<(THREE.Group | null)[]>([]);
  const edges = useRef<Line2 | null>(null);
  const spokes = useRef<Line2 | null>(null);
  const tmp = useMemo(
    () => ({
      a: makeLayout(),
      b: makeLayout(),
      ca: new THREE.Vector3(),
      cb: new THREE.Vector3(),
      hero: new THREE.Vector3(),
      p: new THREE.Vector3(),
      q: new THREE.Vector3(),
      lift: new Float32Array(N),
      packetT: isoEdges.map((_, i) => (i * 0.37) % 1),
      edgeBuf: new Float32Array(isoEdges.length * 6),
      spokeBuf: new Float32Array(N * 6),
    }),
    [],
  );
  const lit = useMemo(() => new THREE.Color(), []);
  const plain = useMemo(() => new THREE.Color(), []);
  const card = useMemo(() => new THREE.Color(), []);
  const index = useMemo(() => new Map(isoNodes.map((n, i) => [n.id, i])), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = clock.elapsedTime;
    const { reduced } = shared.current;
    const vw = size.width;
    const vh = size.height;

    // 1. Which two chapters are we between? B takes over as its slot rises from the bottom edge to 60% height.
    const live = anchors
      .map((el) => ({ kind: el.dataset.sceneAnchor as Kind, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= MIN_ANCHOR && rect.height >= MIN_ANCHOR);
    if (live.length === 0) return;
    let k = 0;
    let t = 0;
    for (let i = 1; i < live.length; i++) {
      const r = live[i]!.rect;
      const progress = clamp((vh - (r.top + r.height / 2)) / (vh * 0.4));
      if (progress > 0) {
        k = i;
        t = progress;
      }
    }
    const A = live[Math.max(0, k - 1)]!;
    const B = live[k]!;
    if (k === 0) t = 0;
    if (reduced) t = t >= 0.5 ? 1 : 0;
    const e = smooth(t);

    const weight = (kind: Kind) => (A.kind === kind ? 1 - e : 0) + (B.kind === kind ? e : 0);
    const wHero = weight('hero');
    const wGraph = weight('how') + weight('work');
    const wWork = weight('work');
    const wContact = weight('contact');

    layouts[A.kind](A.rect, tmp.a);
    layouts[B.kind](B.rect, tmp.b);
    anchorCenter(A.rect, vw, vh, tmp.ca);
    anchorCenter(B.rect, vw, vh, tmp.cb);
    const heroAnchor = live.find((l) => l.kind === 'hero');
    if (heroAnchor) anchorCenter(heroAnchor.rect, vw, vh, tmp.hero);

    // 2. Nodes: position, scale, spin (hero), hover lift, colour.
    const active = new Set(projectLayers[shared.current.view] ?? []);
    card.set(colors.card);
    lit.set(colors.primary);
    isoNodes.forEach((n, i) => {
      const h = nodes[i]!;
      const g = h.group;
      if (!g) return;
      tmp.p.copy(tmp.ca).add(tmp.a.pos[i]!);
      tmp.q.copy(tmp.cb).add(tmp.b.pos[i]!);
      g.position.lerpVectors(tmp.p, tmp.q, e);
      g.scale.lerpVectors(tmp.a.scale[i]!, tmp.b.scale[i]!, e);
      const hovered = shared.current.hover === n.id && wHero > 0.6;
      tmp.lift[i] = reduced ? (hovered ? 1 : 0) : tmp.lift[i]! + ((hovered ? 1 : 0) - tmp.lift[i]!) * (1 - Math.exp(-dt * 18));
      g.position.y += tmp.lift[i]! * 0.35 * g.scale.x;
      g.rotation.y = reduced ? 0 : (now * 0.5 + i) * wHero;

      const on = hovered || (shared.current.pings.get(n.id) ?? 0) > now || (wWork > 0.5 && active.has(n.layer));
      plain.set(n.layer === 'api' ? colors.secondary : n.layer === 'queue' ? colors.accent : colors.card);
      const color = wContact > 0.5 ? card : on ? lit : plain;
      for (let m = 1; m < h.materials.length; m++) h.materials[m]!.color.copy(color);
    });

    // 3. Connections: the graph's edges, or spokes into the photo in the hero.
    const bottom = (i: number) => nodes[i]!.group!.position;
    if (edges.current) {
      isoEdges.forEach(([a, b], i) => {
        const pa = bottom(index.get(a)!);
        const pb = bottom(index.get(b)!);
        tmp.edgeBuf.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
      });
      edges.current.geometry.setPositions(tmp.edgeBuf);
      edges.current.material.opacity = wGraph;
      edges.current.visible = wGraph > 0.02;
    }
    if (spokes.current) {
      isoNodes.forEach((_, i) => {
        const p = bottom(i);
        tmp.spokeBuf.set([p.x, p.y, p.z, tmp.hero.x, tmp.hero.y, tmp.hero.z], i * 6);
      });
      spokes.current.geometry.setPositions(tmp.spokeBuf);
      spokes.current.computeLineDistances();
      spokes.current.material.opacity = wHero * 0.9;
      spokes.current.visible = wHero > 0.02 && !!heroAnchor;
    }

    // 4. Packets ride whichever connections are showing; arrivals light their target node.
    const spokeMode = wHero >= wGraph;
    const showPackets = !reduced && Math.max(wHero, wGraph) > 0.5;
    const s = nodes[0]!.group?.scale.x ?? 1;
    isoEdges.forEach(([a, b], i) => {
      const pg = packets.current[i];
      if (!pg) return;
      pg.visible = showPackets;
      if (!showPackets) return;
      tmp.packetT[i]! += dt / (1.4 + (i % 3) * 0.35);
      if (tmp.packetT[i]! >= 1) {
        tmp.packetT[i]! -= 1;
        if (!spokeMode && Math.random() < 0.5) shared.current.pings.set(b, now + 0.16);
      }
      const from = spokeMode ? bottom(i % N) : bottom(index.get(a)!);
      const to = spokeMode ? tmp.hero : bottom(index.get(b)!);
      pg.position.lerpVectors(from, to, tmp.packetT[i]!);
      pg.position.y += (PACKET * s) / 2;
      pg.scale.setScalar(PACKET * Math.max(s, 0.45));
    });
  });

  return (
    <>
      <Line
        ref={(l) => void (edges.current = l as unknown as Line2 | null)}
        points={Array.from({ length: isoEdges.length * 2 }, () => [0, 0, 0] as [number, number, number])}
        segments
        color={colors.foreground}
        lineWidth={2.5}
        transparent
        frustumCulled={false}
      />
      <Line
        ref={(l) => void (spokes.current = l as unknown as Line2 | null)}
        points={Array.from({ length: N * 2 }, () => [0, 0, 0] as [number, number, number])}
        segments
        color={colors.foreground}
        lineWidth={2}
        dashed
        dashSize={0.2}
        gapSize={0.15}
        transparent
        frustumCulled={false}
      />
      {isoNodes.map((node, i) => (
        <Node key={node.id} node={node} colors={colors} handles={nodes[i]!} shared={shared} />
      ))}
      {isoEdges.map((_, i) => (
        <group key={i} ref={(g) => void (packets.current[i] = g)}>
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={colors.primary} />
          </mesh>
          <Line points={PACKET_OUTLINE} segments color={colors.foreground} lineWidth={2} />
        </group>
      ))}
    </>
  );
}

/** Pauses rendering while the tab is hidden. */
function FrameGate() {
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => {
    const sync = () => setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [setFrameloop]);
  return null;
}

export default function BackgroundScene() {
  const shared = useRef<Shared>({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    view: document.querySelector<HTMLElement>('[data-fig]')?.dataset.view ?? '',
    hover: null,
    pings: new Map(),
  });
  const [colors, setColors] = useState<ThemeColors>(readThemeColors);

  useEffect(() => {
    const onView = (event: Event) => void (shared.current.view = (event as CustomEvent<string>).detail);
    document.addEventListener('rp:view', onView);
    const theme = new MutationObserver(() => setColors(readThemeColors()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      document.removeEventListener('rp:view', onView);
      theme.disconnect();
    };
  }, []);

  return (
    <Canvas
      orthographic
      flat
      dpr={[1, 1.5]}
      camera={{ position: VIEW.clone().multiplyScalar(60).toArray(), zoom: ZOOM, near: 0.1, far: 500 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      eventSource={document.documentElement}
      eventPrefix="client"
      gl={{ alpha: true, antialias: true }}
    >
      <FrameGate />
      <Director colors={colors} shared={shared} />
    </Canvas>
  );
}
