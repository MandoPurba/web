import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { FACE_COLS, FACE_ROWS, faces, lookingFaces, type Face } from '@/data/mascot';
import { readThemeColors, type ThemeColors } from '@/lib/theme-colors';

/**
 * The site mascot: a cat whose box head is a screen. Built from boxes with black outlines and a
 * hard offset shadow, like every card on the site. It lives in the bottom-left corner, looks at
 * the cursor and reacts to the page. Click it too often and it grabs your cursor until you shake
 * it off.
 *
 * Units are CSS pixels: an orthographic camera with zoom 1 over a fixed, full-viewport canvas.
 * The model is authored in "design pixels" (the concept SVG) and drawn at SCALE.
 */

const SCALE = 0.7;
const MARGIN = { left: 28, bottom: 24 };
/** Model bounds in design pixels, y up (for the hit box and home position). */
const BOUNDS = { x0: -76, x1: 84, y0: -152, y1: 100 };
const CELL = 7;
const HARD_SHADOW = 6;
const ARM = 40;
const SHOULDER = { left: new THREE.Vector2(-41, -72), right: new THREE.Vector2(41, -72) };

const GRAVITY = 2600;
const CLICKS_TO_ANGER = 5;
const CLICK_WINDOW = 2.5;
const GRAB_TIMEOUT = 10;

type Mode = 'home' | 'grab' | 'thrown' | 'away' | 'return';
type ColorKey = 'case' | 'body' | 'screen' | 'primary';

interface BoxSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: ColorKey;
}

// ── Model (design pixels, y up) ─────────────────────────────────────────────

const HEAD: BoxSpec[] = [
  { x: 0, y: 0, z: 0, w: 140, h: 112, d: 90, color: 'case' },
  { x: -53, y: 67, z: -10, w: 30, h: 26, d: 30, color: 'case' },
  { x: -53, y: 88, z: -10, w: 14, h: 16, d: 20, color: 'case' },
  { x: 53, y: 67, z: -10, w: 30, h: 26, d: 30, color: 'case' },
  { x: 53, y: 88, z: -10, w: 14, h: 16, d: 20, color: 'case' },
];
const BODY: BoxSpec[] = [
  { x: 0, y: -62, z: 0, w: 32, h: 12, d: 30, color: 'case' },
  { x: 0, y: -94, z: 0, w: 68, h: 56, d: 44, color: 'body' },
  { x: -16, y: -131, z: 0, w: 20, h: 22, d: 20, color: 'case' },
  { x: 16, y: -131, z: 0, w: 20, h: 22, d: 20, color: 'case' },
];
/** Relative to the shoulder pivot. */
const ARM_PARTS: BoxSpec[] = [
  { x: 0, y: -20, z: 0, w: 14, h: ARM, d: 16, color: 'body' },
  { x: 0, y: -41, z: 0, w: 14, h: 10, d: 16, color: 'case' },
];
const TAIL = [
  { x: 46, y: -122 },
  { x: 58, y: -114 },
  { x: 66, y: -102 },
  { x: 70, y: -90 },
];

interface Pose {
  headX: number;
  headY: number;
  armL: number;
  armR: number;
  time: number;
  face: Face;
  shiftX: number;
  shiftY: number;
}

interface Brain {
  reduced: boolean;
  mode: Mode;
  modeAt: number;
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  rot: number;
  spin: number;
  pointer: { x: number; y: number };
  samples: { x: number; y: number; t: number }[];
  lastInput: number;
  hoverMascot: boolean;
  hoverTarget: { kind: 'cta' | 'mail' | 'link'; x: number; y: number } | null;
  clicks: number[];
  forced: { face: Face; until: number } | null;
  hopAt: number;
  surprisedUntil: number;
  dizzyUntil: number;
  reading: boolean;
}

const now = () => performance.now() / 1000;
const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));

function colorOf(key: ColorKey, colors: ThemeColors) {
  return { case: colors.mascotCase, body: colors.mascotBody, screen: colors.mascotScreen, primary: colors.primary }[key];
}

/** Outline thickness in design pixels (≈ 2.5 CSS px at SCALE). */
const OUTLINE = 4;

/**
 * A box drawn the neo-brutalist way: coloured front, ink sides/top (they read as a thick edge when
 * the head turns), and an inverted hull behind it for the outline. `shadow` = flat ink copy.
 */
function Box({ spec, colors, shadow }: { spec: BoxSpec; colors: ThemeColors; shadow: boolean }) {
  const materials = useMemo(() => {
    // Sides stay black in both themes (like the dark faces of the isometric drawings).
    const ink = new THREE.MeshBasicMaterial({ color: shadow ? colors.border : colors.primaryForeground });
    const front = new THREE.MeshBasicMaterial({ color: shadow ? colors.border : colorOf(spec.color, colors) });
    // Face order: +x, -x, +y, -y, +z (front), -z.
    return [ink, ink, ink, ink, front, ink];
  }, [colors, shadow, spec.color]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return (
    <group position={[spec.x, spec.y, spec.z]}>
      <mesh material={materials}>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
      </mesh>
      {!shadow && (
        <mesh>
          <boxGeometry args={[spec.w + OUTLINE * 2, spec.h + OUTLINE * 2, spec.d + OUTLINE * 2]} />
          <meshBasicMaterial color={colors.border} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

/** The screen face: a pixel grid redrawn only when the expression or gaze changes. */
function Screen({ pose, colors }: { pose: RefObject<Pose>; colors: ThemeColors }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const key = useRef('');
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(
    () => ({ '#': new THREE.Color(colors.primary), w: new THREE.Color(colors.mascotBody), r: new THREE.Color(colors.destructive) }),
    [colors],
  );
  const count = FACE_COLS * FACE_ROWS;

  useEffect(() => {
    key.current = '';
  }, [palette]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const { face, shiftX, shiftY } = pose.current;
    const next = `${face}:${shiftX}:${shiftY}`;
    if (next === key.current) return;
    key.current = next;
    const rows = faces[face];
    for (let r = 0; r < FACE_ROWS; r++) {
      for (let c = 0; c < FACE_COLS; c++) {
        const ch = rows[r - shiftY]?.[c - shiftX] as keyof typeof palette | undefined;
        const on = !!ch && ch in palette;
        tmp.position.set(-56 + c * CELL + CELL / 2, 35 - r * CELL - CELL / 2, 46);
        tmp.scale.setScalar(on ? 1 : 0.0001);
        tmp.updateMatrix();
        const i = r * FACE_COLS + c;
        m.setMatrixAt(i, tmp.matrix);
        if (on) m.setColorAt(i, palette[ch]);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <mesh position={[0, 0, 45.5]}>
        <planeGeometry args={[120, 92]} />
        <meshBasicMaterial color={colors.mascotScreen} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <planeGeometry args={[CELL, CELL]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </>
  );
}

/** One copy of the cat. `shadow` draws the hard offset shadow (flat border colour, no details). */
function Model({ pose, colors, shadow }: { pose: RefObject<Pose>; colors: ThemeColors; shadow: boolean }) {
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const tail = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const p = pose.current;
    head.current?.rotation.set(p.headX, p.headY, 0);
    if (armL.current) armL.current.rotation.z = p.armL;
    if (armR.current) armR.current.rotation.z = p.armR;
    tail.current.forEach((g, i) => {
      if (!g) return;
      g.position.x = TAIL[i]!.x + Math.sin(p.time * 3 + i * 0.9) * 2 * (i + 1);
    });
  });

  const tailSpec = (i: number): BoxSpec => ({ x: 0, y: 0, z: -18, w: 12, h: 12, d: 12, color: i === TAIL.length - 1 ? 'primary' : 'body' });

  return (
    <group position={shadow ? [HARD_SHADOW / SCALE, -HARD_SHADOW / SCALE, -120] : [0, 0, 0]}>
      {TAIL.map((t, i) => (
        <group key={i} ref={(g) => void (tail.current[i] = g)} position={[t.x, t.y, 0]}>
          <Box spec={tailSpec(i)} colors={colors} shadow={shadow} />
        </group>
      ))}
      {BODY.map((spec, i) => (
        <Box key={i} spec={spec} colors={colors} shadow={shadow} />
      ))}
      {(['left', 'right'] as const).map((side) => (
        <group key={side} ref={side === 'left' ? armL : armR} position={[SHOULDER[side].x, SHOULDER[side].y, 24]}>
          {ARM_PARTS.map((spec, i) => (
            <Box key={i} spec={spec} colors={colors} shadow={shadow} />
          ))}
        </group>
      ))}
      <group ref={head}>
        {HEAD.map((spec, i) => (
          <Box key={i} spec={spec} colors={colors} shadow={shadow} />
        ))}
        {!shadow && (
          <>
            {[-53, 53].map((x) => (
              <mesh key={x} position={[x, 69, 5.5]}>
                <planeGeometry args={[10, 10]} />
                <meshBasicMaterial color={colors.primary} />
              </mesh>
            ))}
            <Screen pose={pose} colors={colors} />
          </>
        )}
      </group>
    </group>
  );
}

/** Screen offset (CSS px) from the head centre to the right paw's tip. */
function pawOffset(armR: number) {
  const tip = new THREE.Vector2(0, -(ARM + 6)).rotateAround(new THREE.Vector2(), armR).add(SHOULDER.right);
  return new THREE.Vector2(tip.x * SCALE, -tip.y * SCALE);
}

function homeOf(vh: number) {
  return new THREE.Vector2(MARGIN.left - BOUNDS.x0 * SCALE, vh - MARGIN.bottom + BOUNDS.y0 * SCALE);
}

/** Decides what the cat does each frame and writes it into the pose, the root group and the DOM layers. */
function Director({
  brain,
  pose,
  root,
  hitbox,
  cursor,
  onMode,
}: {
  brain: RefObject<Brain>;
  pose: RefObject<Pose>;
  root: RefObject<THREE.Group | null>;
  hitbox: RefObject<HTMLDivElement | null>;
  cursor: RefObject<HTMLDivElement | null>;
  onMode: (mode: Mode) => void;
}) {
  const { size } = useThree();
  const blinkAt = useRef(0);

  useFrame((_, delta) => {
    const b = brain.current;
    const p = pose.current;
    const g = root.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const t = now();
    const vw = size.width;
    const vh = size.height;
    const home = homeOf(vh);
    const setMode = (mode: Mode) => {
      b.mode = mode;
      b.modeAt = t;
      onMode(mode);
    };

    // 1. Where is it?
    let bob = 0;
    let hop = 0;
    g.visible = b.mode !== 'away';
    switch (b.mode) {
      case 'home': {
        const k = b.reduced ? 1 : 1 - Math.exp(-dt * 10);
        b.pos.lerp(home, k);
        b.rot += (0 - b.rot) * k;
        if (!b.reduced) {
          const asleep = t - b.lastInput > 60;
          bob = Math.sin(t * 2.2) * (asleep ? 2 : 5);
          const since = t - b.hopAt;
          if (since < 0.35) hop = -Math.sin((since / 0.35) * Math.PI) * 22;
        }
        break;
      }
      case 'grab': {
        const off = pawOffset(p.armR);
        const target = new THREE.Vector2(b.pointer.x - off.x, b.pointer.y - off.y);
        const prev = b.pos.clone();
        b.pos.lerp(target, 1 - Math.exp(-dt * 5));
        b.vel.copy(b.pos).sub(prev).divideScalar(dt || 1);
        b.rot = clamp(b.vel.x * 0.0005, -0.35, 0.35);
        if (t - b.modeAt > GRAB_TIMEOUT) throwCat(b, new THREE.Vector2(0, -1400), setMode);
        break;
      }
      case 'thrown': {
        b.vel.y += GRAVITY * dt;
        b.pos.addScaledVector(b.vel, dt);
        b.rot += b.spin * dt;
        if (b.pos.y > vh + 260 || b.pos.x < -260 || b.pos.x > vw + 260) setMode('away');
        break;
      }
      case 'away': {
        if (t - b.modeAt > 0.9) {
          b.pos.set(home.x, vh + 220);
          b.rot = 0;
          setMode('return');
        }
        break;
      }
      case 'return': {
        b.pos.lerp(home, 1 - Math.exp(-dt * 7));
        if (b.pos.distanceTo(home) < 2) {
          b.dizzyUntil = t + 1.6;
          setMode('home');
        }
        break;
      }
    }

    // 2. What does it look at, and which face?
    const target = b.hoverTarget ?? b.pointer;
    const lookX = clamp((target.x - b.pos.x) / 450);
    const lookY = clamp((target.y - b.pos.y) / 450);

    let face: Face = 'idle';
    const idleFor = t - b.lastInput;
    if (b.mode === 'grab') face = 'angry';
    else if (b.mode === 'thrown' || b.mode === 'away') face = 'surprised';
    else if (b.mode === 'return' || t < b.dizzyUntil) face = 'dizzy';
    else if (b.forced && t < b.forced.until) face = b.forced.face;
    else if (b.hoverMascot) face = 'curious';
    else if (b.hoverTarget?.kind === 'cta') face = 'excited';
    else if (b.hoverTarget?.kind === 'mail') face = 'love';
    else if (b.hoverTarget) face = 'curious';
    else if (t < b.surprisedUntil) face = 'surprised';
    else if (b.reading) face = 'reading';
    else if (idleFor > 60) face = 'asleep';
    else if (idleFor > 20) face = 'sleepy';
    if (face === 'idle') {
      if (t > blinkAt.current + 3.6) blinkAt.current = t;
      if (t - blinkAt.current < 0.12) face = 'blink';
    }

    // 3. Pose.
    p.time = t;
    p.face = face;
    const looks = lookingFaces.has(face);
    p.shiftX = looks ? Math.round(clamp(lookX * 1.3)) : 0;
    p.shiftY = looks ? Math.round(clamp(lookY * 1.3)) : 0;
    p.headY = b.reduced ? lookX * 0.25 : p.headY + (lookX * 0.28 - p.headY) * (1 - Math.exp(-dt * 8));
    p.headX = b.reduced ? lookY * 0.16 : p.headX + (lookY * 0.18 - p.headX) * (1 - Math.exp(-dt * 8));
    if (face === 'angry' && !b.reduced) p.headY += Math.sin(t * 40) * 0.1;

    const sway = b.reduced ? 0 : Math.sin(t * 1.6) * 0.08;
    let armL = -sway;
    let armR = sway;
    if (b.mode === 'grab') {
      armR = 2.7;
      armL = -0.9 + Math.sin(t * 22) * 0.45;
    } else if (b.mode === 'thrown' || b.mode === 'away') {
      armR = 2.6;
      armL = -2.6;
    } else if (face === 'happy') {
      armR = 2.5 + Math.sin(t * 14) * 0.35;
    } else if (face === 'excited') {
      armR = 0.7;
      armL = -0.7;
    }
    const ease = b.reduced ? 1 : 1 - Math.exp(-dt * 14);
    p.armL += (armL - p.armL) * ease;
    p.armR += (armR - p.armR) * ease;

    // 4. Write to the scene and the DOM layers.
    const y = b.pos.y + bob + hop;
    g.position.set(b.pos.x - vw / 2, vh / 2 - y, 0);
    g.rotation.z = -b.rot;
    if (hitbox.current) {
      hitbox.current.style.transform = `translate(${b.pos.x + BOUNDS.x0 * SCALE}px, ${y - BOUNDS.y1 * SCALE}px)`;
      hitbox.current.style.pointerEvents = b.mode === 'home' ? 'auto' : 'none';
    }
    if (cursor.current) {
      const off = pawOffset(p.armR);
      cursor.current.style.transform = `translate(${b.pos.x + off.x}px, ${y + off.y}px)`;
    }
  });

  return null;
}

function throwCat(b: Brain, velocity: THREE.Vector2, setMode: (mode: Mode) => void) {
  const v = velocity.clone();
  const speed = v.length();
  if (speed < 1100) v.setLength(1100);
  if (speed > 2800) v.setLength(2800);
  v.y -= 500;
  b.vel.copy(v);
  b.spin = clamp(v.x * 0.012, -18, 18);
  b.samples = [];
  setMode('thrown');
}

/** Shake = lots of left/right reversals over a long path in under a second. */
function isShake(samples: Brain['samples']) {
  let reversals = 0;
  let path = 0;
  let sign = 0;
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i]!.x - samples[i - 1]!.x;
    const dy = samples[i]!.y - samples[i - 1]!.y;
    path += Math.hypot(dx, dy);
    if (Math.abs(dx) > 4) {
      const s = Math.sign(dx);
      if (sign && s !== sign) reversals++;
      sign = s;
    }
  }
  return reversals >= 5 && path >= 800;
}

export default function Mascot() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const brain = useRef<Brain>({
    reduced,
    mode: 'home',
    modeAt: now(),
    pos: homeOf(innerHeight),
    vel: new THREE.Vector2(),
    rot: 0,
    spin: 0,
    pointer: { x: innerWidth / 2, y: innerHeight / 2 },
    samples: [],
    lastInput: now(),
    hoverMascot: false,
    hoverTarget: null,
    clicks: [],
    forced: null,
    hopAt: -10,
    surprisedUntil: 0,
    dizzyUntil: 0,
    reading: false,
  });
  const pose = useRef<Pose>({ headX: 0, headY: 0, armL: 0, armR: 0, time: 0, face: 'idle', shiftX: 0, shiftY: 0 });
  const root = useRef<THREE.Group>(null);
  const hitbox = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('home');
  const [colors, setColors] = useState<ThemeColors>(readThemeColors);

  useEffect(() => {
    const b = brain.current;
    let lastScroll = scrollY;
    let lastScrollAt = now();

    const onMove = (e: PointerEvent) => {
      const t = now();
      b.pointer = { x: e.clientX, y: e.clientY };
      b.lastInput = t;
      if (b.mode !== 'grab') return;
      b.samples.push({ x: e.clientX, y: e.clientY, t });
      b.samples = b.samples.filter((s) => t - s.t < 0.8);
      if (isShake(b.samples)) {
        const recent = b.samples.filter((s) => t - s.t < 0.1);
        const first = recent[0] ?? b.samples[0]!;
        const dt = Math.max(0.016, t - first.t);
        throwCat(b, new THREE.Vector2((e.clientX - first.x) / dt, (e.clientY - first.y) / dt), (m) => {
          b.mode = m;
          b.modeAt = t;
          setMode(m);
        });
      }
    };
    const classify = (el: Element | null) => {
      const target = el?.closest<HTMLElement>('a, button, [data-card]');
      if (!target || target.closest('[data-mascot]')) return null;
      const r = target.getBoundingClientRect();
      const href = target.getAttribute('href') ?? '';
      const kind = href.startsWith('mailto:') ? 'mail' : href === '#work' || target.hasAttribute('data-cta') ? 'cta' : 'link';
      return { kind, x: r.left + r.width / 2, y: r.top + r.height / 2 } as const;
    };
    const onOver = (e: MouseEvent) => {
      b.hoverTarget = classify(e.target as Element);
    };
    const onScroll = () => {
      const t = now();
      const speed = Math.abs(scrollY - lastScroll) / Math.max(0.016, t - lastScrollAt);
      if (speed > 2500) b.surprisedUntil = t + 0.6;
      lastScroll = scrollY;
      lastScrollAt = t;
      b.lastInput = t;
      b.hoverTarget = null;
    };
    const onKey = (e: KeyboardEvent) => {
      b.lastInput = now();
      if (e.key === 'Escape' && b.mode === 'grab')
        throwCat(b, new THREE.Vector2(0, -1400), (m) => {
          b.mode = m;
          b.modeAt = now();
          setMode(m);
        });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('keydown', onKey);

    const writing = document.getElementById('writing');
    const io = new IntersectionObserver(([entry]) => void (b.reading = !!entry?.isIntersecting), { threshold: 0.35 });
    if (writing) io.observe(writing);

    const theme = new MutationObserver(() => setColors(readThemeColors()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      removeEventListener('scroll', onScroll);
      removeEventListener('keydown', onKey);
      io.disconnect();
      theme.disconnect();
    };
  }, []);

  const onClick = () => {
    const b = brain.current;
    const t = now();
    b.lastInput = t;
    b.clicks = [...b.clicks.filter((c) => t - c < CLICK_WINDOW), t];
    const n = b.clicks.length;
    if (n >= CLICKS_TO_ANGER && !b.reduced) {
      b.clicks = [];
      b.samples = [];
      b.mode = 'grab';
      b.modeAt = t;
      setMode('grab');
    } else if (n >= 3) {
      b.forced = { face: 'angry', until: t + 0.9 };
    } else {
      b.forced = { face: 'happy', until: t + 0.8 };
      b.hopAt = t;
    }
  };

  const flying = mode !== 'home' && mode !== 'return';

  return (
    <div data-mascot aria-hidden="true">
      <div className={`pointer-events-none fixed inset-0 ${flying ? 'z-[97]' : 'z-[45]'}`}>
        <Canvas
          orthographic
          flat
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 1000], zoom: 1, near: 1, far: 3000 }}
          gl={{ alpha: true, antialias: true }}
        >
          <Director brain={brain} pose={pose} root={root} hitbox={hitbox} cursor={cursor} onMode={setMode} />
          <group ref={root} scale={SCALE}>
            <Model pose={pose} colors={colors} shadow />
            <Model pose={pose} colors={colors} shadow={false} />
          </group>
        </Canvas>
      </div>
      {/* Click target that follows the cat (the canvas itself never takes pointer events). */}
      <div
        ref={hitbox}
        onClick={onClick}
        onPointerEnter={() => void (brain.current.hoverMascot = true)}
        onPointerLeave={() => void (brain.current.hoverMascot = false)}
        className="fixed top-0 left-0 z-[46] cursor-pointer"
        style={{ width: (BOUNDS.x1 - BOUNDS.x0) * SCALE, height: (BOUNDS.y1 - BOUNDS.y0) * SCALE }}
      />
      {mode === 'grab' && (
        <>
          {/* While it holds the cursor: the page can't be clicked and the real cursor is hidden. */}
          <div className="fixed inset-0 z-[98] cursor-none" onClick={(e) => e.preventDefault()} />
          <div ref={cursor} className="pointer-events-none fixed top-0 left-0 z-[99]">
            <svg width="22" height="28" viewBox="0 0 11 14" shapeRendering="crispEdges" className="-translate-x-[2px] -translate-y-[2px]">
              <path
                d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-4v1h1v1h1v1h-2v1h-2v-1h-1v-1h-1v1h-1v1h-1z"
                className="fill-foreground stroke-background"
                strokeWidth="0.6"
              />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
