import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { isoEdges, isoGrid, isoLayers, isoNodes, type IsoNode, type Layer } from '@/data/iso';
import { readThemeColors, type ThemeColors } from '@/lib/theme-colors';

// Isometric view: camera looks down the (1,1,1) diagonal. World axes: X = grid x, Y = up, Z = grid y.
const VIEW = new THREE.Vector3(1, 1, 1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(-1, 2, -1).normalize();
/** Smallest framed area in world units, so a single layer doesn't fill the whole panel. */
const MIN_FRAME = { w: 8.3, h: 6.7 };
const PAD = 0.9;
const PACKET = 0.22;

// Motion, in seconds / world units. Stepped easing keeps it sharp and mechanical.
const DROP = { from: 2, delay: 0.3, stagger: 0.09, duration: 0.32, steps: 4 };
const DRAW = { stagger: 0.04, duration: 0.3 };
const LIFT = { active: 0.28, hover: 0.16, hop: 0.2, ping: 0.1 };
const HOP_EVERY = 1.4;
const HOP_FOR = 0.24;
const PING_FOR = 0.16;

const order = [...isoNodes].sort((a, b) => a.x + a.y - (b.x + b.y));
const dropDelay = new Map(order.map((n, i) => [n.id, DROP.delay + i * DROP.stagger]));
const DRAW_START = DROP.delay + (order.length - 1) * DROP.stagger + DROP.duration;
const FLOW_START = DRAW_START + (isoEdges.length - 1) * DRAW.stagger + DRAW.duration;

const byId = new Map(isoNodes.map((n) => [n.id, n]));
const centerOf = (n: IsoNode) => new THREE.Vector3(n.x + 0.5, 0, n.y + 0.5);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const stepped = (v: number, steps: number) => Math.floor(clamp01(v) * steps) / steps;
const expoOut = (v: number) => (v >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(v)));

/** Hard edges of a geometry as line-segment endpoints (for thick `Line` outlines). */
function edgePoints(geometry: THREE.BufferGeometry): [number, number, number][] {
  const array = new THREE.EdgesGeometry(geometry).attributes.position!.array;
  const points: [number, number, number][] = [];
  for (let i = 0; i < array.length; i += 3) points.push([array[i]!, array[i + 1]!, array[i + 2]!]);
  geometry.dispose();
  return points;
}

function Outline({ points, color, width }: { points: [number, number, number][]; color: string; width: number }) {
  return <Line points={points} segments color={color} lineWidth={width} />;
}

const FOOTPRINT = edgePoints(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
const PACKET_EDGES = edgePoints(new THREE.BoxGeometry(PACKET, PACKET, PACKET));

/** Shared, non-reactive animation state read inside `useFrame`. */
interface Motion {
  reduced: boolean;
  layer: Layer;
  hover: string | null;
  /** node id → time until which it is lifted / lit. */
  hops: Map<string, number>;
  pings: Map<string, number>;
}

/** Screen-space bounds of a set of nodes → camera target + framed size. */
function frame(nodes: IsoNode[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const p = new THREE.Vector3();
  for (const n of nodes) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, n.h + 0.9, 0], [1, n.h + 0.9, 1]]) {
      p.set(n.x + dx!, dy!, n.y + dz!);
      const sx = p.dot(RIGHT);
      const sy = p.dot(UP);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  }
  const target = RIGHT.clone().multiplyScalar((x0 + x1) / 2).addScaledVector(UP, (y0 + y1) / 2);
  return { target, w: Math.max(x1 - x0 + 2 * PAD, MIN_FRAME.w), h: Math.max(y1 - y0 + 2 * PAD, MIN_FRAME.h) };
}

const FRAMES = Object.fromEntries(
  isoLayers.map((l) => [l.id, frame(isoNodes.filter((n) => n.layer === l.id))]),
) as Record<Layer, ReturnType<typeof frame>>;

function Rig({ motion }: { motion: RefObject<Motion> }) {
  const { camera, size } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);
  const zoom = useRef(0);
  useFrame((_, dt) => {
    const f = FRAMES[motion.current.layer];
    const z = Math.min(size.width / f.w, size.height / f.h);
    const k = motion.current.reduced || !target.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 7);
    target.current ??= f.target.clone();
    target.current.lerp(f.target, k);
    zoom.current += (z - zoom.current) * k;
    camera.position.copy(target.current).addScaledVector(VIEW, 50);
    camera.lookAt(target.current);
    camera.zoom = zoom.current;
    camera.updateProjectionMatrix();
  });
  return null;
}

const LABEL =
  'pointer-events-none font-mono text-[11px] font-bold tracking-[0.06em] whitespace-nowrap uppercase [text-shadow:2px_0_var(--background),-2px_0_var(--background),0_2px_var(--background),0_-2px_var(--background)]';

function requestLayer(layer: Layer) {
  document.dispatchEvent(new CustomEvent('rp:layer-request', { detail: layer }));
}

function Node({ node, colors, motion }: { node: IsoNode; colors: ThemeColors; motion: RefObject<Motion> }) {
  const group = useRef<THREE.Group>(null);
  const label = useRef<HTMLSpanElement>(null);
  const lift = useRef(0);
  const base = node.layer === 'api' ? colors.secondary : node.layer === 'queue' ? colors.accent : colors.card;
  const materials = useMemo(
    () => [colors.primaryForeground, base, base, base, base, base].map((c) => new THREE.MeshBasicMaterial({ color: c })),
    [colors, base],
  );
  const lit = useMemo(() => new THREE.Color(colors.primary), [colors]);
  const plain = useMemo(() => new THREE.Color(base), [base]);
  const outline = useMemo(() => edgePoints(new THREE.BoxGeometry(1, node.h, 1)), [node.h]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const m = motion.current;
    const now = clock.elapsedTime;
    const delay = dropDelay.get(node.id)!;

    // Intro: stepped drop from above, staggered back-to-front.
    const drop = m.reduced ? 1 : stepped((now - delay) / DROP.duration, DROP.steps);
    g.visible = m.reduced || now >= delay;

    const active = node.layer === m.layer;
    const pinged = (m.pings.get(node.id) ?? 0) > now;
    const target =
      (active ? LIFT.active : 0) +
      (m.hover === node.id ? LIFT.hover : 0) +
      ((m.hops.get(node.id) ?? 0) > now ? LIFT.hop : 0) +
      (pinged ? LIFT.ping : 0);
    lift.current = m.reduced ? target : lift.current + (target - lift.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 22));
    g.position.y = (1 - drop) * DROP.from + lift.current;

    const color = active || pinged ? lit : plain;
    for (const i of [1, 2, 3, 4, 5]) materials[i]!.color.copy(color);
    if (label.current) label.current.style.color = active ? 'var(--foreground)' : 'var(--muted-foreground)';
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    motion.current.hover = node.id;
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    if (motion.current.hover === node.id) motion.current.hover = null;
    document.body.style.cursor = '';
  };

  return (
    <group position={[node.x + 0.5, 0, node.y + 0.5]}>
      {/* Footprint stays on the ground so lifted blocks read as floating. */}
      <group position-y={0.005}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={colors.muted} />
        </mesh>
        <Outline points={FOOTPRINT} color={colors.foreground} width={1.5} />
      </group>
      <group ref={group}>
        <mesh
          position={[0, node.h / 2, 0]}
          material={materials}
          onPointerOver={onOver}
          onPointerOut={onOut}
          onClick={(e) => {
            e.stopPropagation();
            requestLayer(node.layer);
          }}
        >
          <boxGeometry args={[1, node.h, 1]} />
        </mesh>
        <group position-y={node.h / 2}>
          <Outline points={outline} color={colors.foreground} width={2.5} />
        </group>
        <Html position={[0, node.h + 0.45, 0]} center zIndexRange={[10, 0]}>
          <span ref={label} className={LABEL}>
            {node.label}
          </span>
        </Html>
      </group>
    </group>
  );
}

/** Connections draw in one after another once the blocks have landed (scaled from their start point). */
function Links({ colors, motion }: { colors: ThemeColors; motion: RefObject<Motion> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const segments = useMemo(
    () =>
      isoEdges.map(([a, b]) => {
        const from = centerOf(byId.get(a)!).setY(0.01);
        const to = centerOf(byId.get(b)!).setY(0.01);
        return { from, delta: to.sub(from) };
      }),
    [],
  );
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    segments.forEach((_, i) => {
      const g = groups.current[i];
      if (!g) return;
      const k = motion.current.reduced ? 1 : expoOut((now - DRAW_START - i * DRAW.stagger) / DRAW.duration);
      g.visible = k > 0;
      g.scale.setScalar(Math.max(k, 0.0001));
    });
  });
  return segments.map(({ from, delta }, i) => (
    <group key={i} ref={(g) => void (groups.current[i] = g)} position={from}>
      <Line points={[[0, 0, 0], delta]} color={colors.foreground} lineWidth={2.5} />
    </group>
  ));
}

/** Data packets ride the connections; arriving packets ping their target block. */
function Packets({ colors, motion }: { colors: ThemeColors; motion: RefObject<Motion> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useMemo(
    () =>
      isoEdges.map(([a, b], i) => ({
        from: centerOf(byId.get(a)!).setY(PACKET / 2),
        to: centerOf(byId.get(b)!).setY(PACKET / 2),
        target: b,
        t: (i * 0.37) % 1,
        speed: 1 / (1.2 + (i % 3) * 0.35),
      })),
    [],
  );
  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime;
    const on = now >= FLOW_START;
    state.forEach((p, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.visible = on;
      if (!on) return;
      p.t += Math.min(dt, 0.05) * p.speed;
      if (p.t >= 1) {
        p.t -= 1;
        if (Math.random() < 0.5) motion.current.pings.set(p.target, now + PING_FOR);
      }
      mesh.position.lerpVectors(p.from, p.to, p.t);
    });
  });
  return state.map((_, i) => (
    <group key={i} ref={(m) => void (refs.current[i] = m)}>
      <mesh>
        <boxGeometry args={[PACKET, PACKET, PACKET]} />
        <meshBasicMaterial color={colors.primary} />
      </mesh>
      <Outline points={PACKET_EDGES} color={colors.foreground} width={2} />
    </group>
  ));
}

/** Every so often a random block hops, so the system looks alive when nobody scrolls. */
function Idle({ motion }: { motion: RefObject<Motion> }) {
  const next = useRef(FLOW_START);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (now < next.current) return;
    next.current = now + HOP_EVERY;
    const node = isoNodes[Math.floor(Math.random() * isoNodes.length)]!;
    motion.current.hops.set(node.id, now + HOP_FOR);
  });
  return null;
}

function Ground({ colors }: { colors: ThemeColors }) {
  const grid = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = Math.ceil(isoGrid.x0); i <= isoGrid.x1; i++) pts.push([i, 0, isoGrid.y0], [i, 0, isoGrid.y1]);
    for (let i = Math.ceil(isoGrid.y0); i <= isoGrid.y1; i++) pts.push([isoGrid.x0, 0, i], [isoGrid.x1, 0, i]);
    return pts;
  }, []);
  return <Line points={grid} segments color={colors.muted} lineWidth={2} />;
}

function LayerLabels({ motion }: { motion: RefObject<Motion> }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useFrame(() => {
    isoLayers.forEach((l, i) => {
      const el = refs.current[i];
      if (el) el.style.color = l.id === motion.current.layer ? 'var(--foreground)' : 'var(--muted-foreground)';
    });
  });
  return isoLayers.map((l, i) => (
    <Html key={l.id} position={[l.x + 0.5, 0, -1]} center zIndexRange={[10, 0]}>
      <span ref={(el) => void (refs.current[i] = el)} className={LABEL}>
        {l.label}
      </span>
    </Html>
  ));
}

/** Pauses rendering while the figure is offscreen, without re-rendering the React tree. */
function FrameGate({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => {
    if (!target.current) return;
    const io = new IntersectionObserver(([entry]) => setFrameloop(entry?.isIntersecting ? 'always' : 'never'));
    io.observe(target.current);
    return () => io.disconnect();
  }, [setFrameloop, target]);
  return null;
}

function getLayer(): Layer {
  return (document.querySelector<HTMLElement>('[data-iso]')?.dataset.layer as Layer) ?? 'api';
}

export default function IsoScene() {
  const wrapper = useRef<HTMLDivElement>(null);
  const motion = useRef<Motion>({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    layer: getLayer(),
    hover: null,
    hops: new Map(),
    pings: new Map(),
  });
  const [colors, setColors] = useState<ThemeColors>(readThemeColors);
  const reduced = motion.current.reduced;

  useEffect(() => {
    const onLayer = (event: Event) => {
      motion.current.layer = (event as CustomEvent<Layer>).detail;
    };
    document.addEventListener('rp:layer', onLayer);
    const theme = new MutationObserver(() => setColors(readThemeColors()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      document.removeEventListener('rp:layer', onLayer);
      theme.disconnect();
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div ref={wrapper} className="absolute inset-0 bg-background">
      <Canvas orthographic flat dpr={[1, 1.5]} camera={{ near: 0.1, far: 200 }}>
        <FrameGate target={wrapper} />
        <Rig motion={motion} />
        <Ground colors={colors} />
        <LayerLabels motion={motion} />
        <Links colors={colors} motion={motion} />
        {isoNodes.map((node) => (
          <Node key={node.id} node={node} colors={colors} motion={motion} />
        ))}
        {!reduced && <Packets colors={colors} motion={motion} />}
        {!reduced && <Idle motion={motion} />}
      </Canvas>
    </div>
  );
}
