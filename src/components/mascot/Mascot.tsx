import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { FACE_COLS, FACE_ROWS, faces, lookingFaces, type Face } from '@/data/mascot';
import { readThemeColors, type ThemeColors } from '@/lib/theme-colors';

/**
 * The site mascot: a cat whose box head is a screen. Built from boxes with black outlines and a
 * hard offset shadow, like every card on the site. It behaves like a cat:
 *   - wanders anywhere on the screen at random, leaving paw prints that fade slowly; goes home now and then;
 *   - looks at the cursor and reacts to links, CTAs, email links, fast scrolling and Writing;
 *   - stroke it (move the cursor back and forth over it): it purrs, gets sleepy and naps;
 *   - now and then the cursor turns into a fish: it chases it and eats it;
 *   - light mode: now and then it scratches or doodles on a card, or right where it stands;
 *   - dark mode: it carries a flashlight and looks around with it; what the beam hits looks light;
 *   - click it five times quickly: it grabs the cursor until you shake it off (or press Escape).
 *
 * Units are CSS pixels: an orthographic camera with zoom 1 over a fixed, full-viewport canvas.
 * The model is authored in "design pixels" (the concept SVG) and drawn at SCALE.
 */

const SCALE = 0.7;
const MARGIN = { left: 28, bottom: 24 };
/** Model bounds in design pixels, y up (for the hit box, spots and home position). */
const BOUNDS = { x0: -76, x1: 84, y0: -152, y1: 100 };
const CELL = 7;
const HARD_SHADOW = 6;
const OUTLINE = 4;
const ARM = 40;
const SHOULDER = { left: new THREE.Vector2(-41, -72), right: new THREE.Vector2(41, -72) };
const HIP = { left: new THREE.Vector2(-16, -120), right: new THREE.Vector2(16, -120) };

const WALK_SPEED = 95;
const RUN_SPEED = 430;
const REST = [4, 9] as const;
const FISH_EVERY = [45, 80] as const;
const CHASE_TIMEOUT = 12;
const EAT_FOR = 1.3;
const NAP_FOR = 9;
/** Petting, in pixels of cursor travel over the cat (decays over time). */
const PET = { purr: 450, sleepy: 1500, nap: 2600, decay: 0.35 };
const SCRATCH_FOR = 1.6;
const SCRATCH_CHANCE = 0.35;
/** How long scratch marks and doodles stay. */
const MARK_FOR = 12;
/** Paw prints: one every STRIDE px walked; they start fading after a while and fade slowly. */
const PRINTS = { stride: 26, hold: 2, fade: 7, max: 80 };
/** Dark mode: how long the flashlight rests on one place before looking elsewhere. */
const LOOK_AROUND = [2.5, 5] as const;
const BEAM = { start: 8, spot: 90 };
const GRAVITY = 2600;
const CLICKS_TO_ANGER = 5;
const CLICK_WINDOW = 2.5;
const GRAB_TIMEOUT = 10;

type Mode = 'rest' | 'walk' | 'scratch' | 'nap' | 'chase' | 'eat' | 'grab' | 'thrown' | 'away' | 'return';
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
];
/** Relative to the shoulder pivot. */
const ARM_PARTS: BoxSpec[] = [
  { x: 0, y: -20, z: 0, w: 14, h: ARM, d: 16, color: 'body' },
  { x: 0, y: -41, z: 0, w: 14, h: 10, d: 16, color: 'case' },
];
/** Held in the right paw (relative to the shoulder): handle + yellow lens. */
const FLASHLIGHT: BoxSpec[] = [
  { x: 0, y: -54, z: 4, w: 10, h: 20, d: 10, color: 'screen' },
  { x: 0, y: -68, z: 4, w: 18, h: 10, d: 18, color: 'primary' },
];
/** Relative to the hip pivot. */
const LEG: BoxSpec = { x: 0, y: -11, z: 0, w: 20, h: 22, d: 20, color: 'case' };
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
  legL: number;
  legR: number;
  /** 0 = standing, 1 = lying down (nap). */
  lie: number;
  /** Turn of the whole cat toward where it walks (radians). */
  facing: number;
  time: number;
  tailSpeed: number;
  /** Dark mode: holding the flashlight. */
  flash: boolean;
  face: Face;
  shiftX: number;
  shiftY: number;
}

interface Brain {
  reduced: boolean;
  mode: Mode;
  modeAt: number;
  /** Head centre on screen (CSS px). */
  pos: THREE.Vector2;
  /** Where it rests now; home until it wanders. */
  spot: THREE.Vector2;
  target: THREE.Vector2;
  restUntil: number;
  napUntil: number;
  vel: THREE.Vector2;
  rot: number;
  spin: number;
  step: number;
  pointer: { x: number; y: number };
  pointerSeen: boolean;
  samples: { x: number; y: number; t: number }[];
  lastInput: number;
  hoverMascot: boolean;
  hoverTarget: { kind: 'cta' | 'mail' | 'link'; x: number; y: number } | null;
  pet: number;
  clicks: number[];
  forced: { face: Face; until: number } | null;
  hopAt: number;
  surprisedUntil: number;
  dizzyUntil: number;
  reading: boolean;
  nextFishAt: number;
  dark: boolean;
  /** What to do on arrival after a walk. */
  after: 'rest' | 'scratch';
  scratch: ScratchPlan | null;
  /** Paw prints: distance walked since the last print, and which foot is next. */
  trail: number;
  foot: 1 | -1;
  /** Dark mode: where the flashlight points, and where it is heading. */
  aim: THREE.Vector2;
  aimGoal: THREE.Vector2;
  aimUntil: number;
}

interface ScratchPlan {
  /** The card to scratch, or null to scratch the page right where it stands. */
  card: Element | null;
  /** Which side of the card the cat stands on. */
  side: 'left' | 'right';
  stand: THREE.Vector2;
}

const now = () => performance.now() / 1000;
const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));
const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo);

function colorOf(key: ColorKey, colors: ThemeColors) {
  return { case: colors.mascotCase, body: colors.mascotBody, screen: colors.mascotScreen, primary: colors.primary }[key];
}

/**
 * A box drawn the neo-brutalist way: coloured front, ink sides/top (they read as a thick edge when
 * the cat turns), and an inverted hull behind it for the outline. `shadow` = flat ink copy.
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
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const flash = useRef<THREE.Group>(null);

  useFrame(() => {
    const p = pose.current;
    if (flash.current) flash.current.visible = p.flash;
    if (body.current) {
      // Lying down: the whole cat sinks onto its folded legs.
      body.current.position.y = -p.lie * 30;
      body.current.rotation.y = p.facing;
    }
    head.current?.rotation.set(p.headX + p.lie * 0.15, p.headY, p.lie * -0.12);
    if (arms.current[0]) arms.current[0].rotation.z = p.armL;
    if (arms.current[1]) arms.current[1].rotation.z = p.armR;
    if (legs.current[0]) legs.current[0].rotation.x = p.legL + p.lie * 1.4;
    if (legs.current[1]) legs.current[1].rotation.x = p.legR + p.lie * 1.4;
    tail.current.forEach((g, i) => {
      if (!g) return;
      g.position.x = TAIL[i]!.x + Math.sin(p.time * 3 * p.tailSpeed + i * 0.9) * 2 * (i + 1) * (1 - p.lie * 0.7);
    });
  });

  const tailSpec = (i: number): BoxSpec => ({ x: 0, y: 0, z: -18, w: 12, h: 12, d: 12, color: i === TAIL.length - 1 ? 'primary' : 'body' });

  return (
    <group position={shadow ? [HARD_SHADOW / SCALE, -HARD_SHADOW / SCALE, -120] : [0, 0, 0]}>
      <group ref={body}>
        {TAIL.map((t, i) => (
          <group key={i} ref={(g) => void (tail.current[i] = g)} position={[t.x, t.y, 0]}>
            <Box spec={tailSpec(i)} colors={colors} shadow={shadow} />
          </group>
        ))}
        {(['left', 'right'] as const).map((side, i) => (
          <group key={side} ref={(g) => void (legs.current[i] = g)} position={[HIP[side].x, HIP[side].y, 0]}>
            <Box spec={LEG} colors={colors} shadow={shadow} />
          </group>
        ))}
        {BODY.map((spec, i) => (
          <Box key={i} spec={spec} colors={colors} shadow={shadow} />
        ))}
        {(['left', 'right'] as const).map((side, i) => (
          <group key={side} ref={(g) => void (arms.current[i] = g)} position={[SHOULDER[side].x, SHOULDER[side].y, 24]}>
            {ARM_PARTS.map((spec, j) => (
              <Box key={j} spec={spec} colors={colors} shadow={shadow} />
            ))}
            {side === 'right' && (
              <group ref={flash}>
                {FLASHLIGHT.map((spec, j) => (
                  <Box key={j} spec={spec} colors={colors} shadow={shadow} />
                ))}
              </group>
            )}
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
    </group>
  );
}

/** Screen offset (CSS px) from the head centre to the right paw's tip (or `reach` further). */
function pawOffset(armR: number, reach = 6) {
  const tip = new THREE.Vector2(0, -(ARM + reach)).rotateAround(new THREE.Vector2(), armR).add(SHOULDER.right);
  return new THREE.Vector2(tip.x * SCALE, -tip.y * SCALE);
}

function homeOf(vh: number) {
  return new THREE.Vector2(MARGIN.left - BOUNDS.x0 * SCALE, vh - MARGIN.bottom + BOUNDS.y0 * SCALE);
}

/** The cat's screen box when its head centre is at `p`. */
function boxAt(p: THREE.Vector2) {
  return { left: p.x + BOUNDS.x0 * SCALE, top: p.y - BOUNDS.y1 * SCALE, right: p.x + BOUNDS.x1 * SCALE, bottom: p.y - BOUNDS.y0 * SCALE };
}

/** A random place anywhere on screen (below the header). */
function findSpot(vw: number, vh: number): THREE.Vector2 {
  const halfW = ((BOUNDS.x1 - BOUNDS.x0) * SCALE) / 2;
  return new THREE.Vector2(
    halfW + 16 + Math.random() * (vw - halfW * 2 - 32),
    100 + BOUNDS.y1 * SCALE + Math.random() * (vh - 100 - (BOUNDS.y1 - BOUNDS.y0) * SCALE - 20),
  );
}

/** Pick a card on screen and a spot beside it where the cat's paw reaches its edge. */
function planScratch(vw: number, vh: number): ScratchPlan | null {
  const catW = (BOUNDS.x1 - BOUNDS.x0) * SCALE;
  const cards = Array.from(document.querySelectorAll('[class*="shadow-brutal"]')).filter((el) => {
    if (el.closest('[data-mascot], header')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 140 && r.height > 90 && r.top > 100 && r.bottom < vh - 10 && r.left >= 0 && r.right <= vw;
  });
  const card = cards[Math.floor(Math.random() * cards.length)];
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const side = r.left > catW + 30 ? 'left' : r.right < vw - catW - 30 ? 'right' : null;
  if (!side) return null;
  const bottom = Math.min(r.bottom, vh - 24);
  const x = side === 'left' ? r.left + 14 - BOUNDS.x1 * SCALE : r.right - 14 - BOUNDS.x0 * SCALE;
  return { card, side, stand: new THREE.Vector2(x, bottom + BOUNDS.y0 * SCALE) };
}

const DOODLES = {
  scratch: [0, 1, 2]
    .map((i) => `<span class="absolute block h-12 w-1.5 rotate-24 bg-foreground" style="left:${i * 12}px;top:${i * 3}px"></span>`)
    .join(''),
  meow: '<span class="inline-block -rotate-12 font-hand text-4xl leading-none text-secondary">meow</span>',
  heart:
    '<svg width="44" height="40" viewBox="0 0 11 10" shape-rendering="crispEdges" class="fill-destructive"><path d="M1 0h3v1h1V0h1v0h3v1h1v4H9v1H8v1H7v1H6v1H5V8H4V7H3V6H2V5H1V4H0V1h1z"/></svg>',
  scribble:
    '<svg width="64" height="36" viewBox="0 0 64 36" class="fill-none stroke-secondary" stroke-width="4" stroke-linejoin="miter"><polyline points="2,30 12,6 22,30 32,6 42,30 52,6 62,30"/></svg>',
} as const;

/** Leave a scratch or a doodle (on a card, or on the page where the cat stands); it fades out on its own. */
function markAt(plan: ScratchPlan, cat: THREE.Vector2) {
  const kinds = Object.keys(DOODLES) as (keyof typeof DOODLES)[];
  const kind = Math.random() < 0.45 ? 'scratch' : kinds[1 + Math.floor(Math.random() * (kinds.length - 1))]!;
  const catBox = boxAt(cat);
  let x: number;
  let y: number;
  if (plan.card) {
    const r = plan.card.getBoundingClientRect();
    x = plan.side === 'left' ? r.left + 14 : r.right - 70;
    y = Math.min(Math.max(cat.y - 40, r.top + 10), r.bottom - 64);
  } else {
    x = plan.side === 'left' ? catBox.left - 72 : catBox.right + 8;
    y = cat.y - 10;
  }
  const mark = document.createElement('div');
  mark.setAttribute('aria-hidden', 'true');
  mark.className = 'pointer-events-none absolute z-30 h-[52px] w-[64px] transition-opacity duration-[2000ms]';
  mark.style.left = `${x + scrollX}px`;
  mark.style.top = `${y + scrollY}px`;
  mark.innerHTML = DOODLES[kind];
  document.body.append(mark);
  setTimeout(() => (mark.style.opacity = '0'), (MARK_FOR - 2) * 1000);
  setTimeout(() => mark.remove(), MARK_FOR * 1000);
}

const prints: HTMLElement[] = [];
const PAW = '<svg width="14" height="14" viewBox="0 0 7 7" shape-rendering="crispEdges" class="fill-foreground"><rect x="0" y="1" width="1" height="2"/><rect x="2" y="0" width="1" height="2"/><rect x="4" y="0" width="1" height="2"/><rect x="6" y="1" width="1" height="2"/><rect x="1" y="3" width="5" height="4"/></svg>';

/** A paw print on the page (scrolls with it) that stays a moment, then fades slowly. */
function pawPrint(x: number, y: number) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className = 'pointer-events-none absolute z-20 opacity-40';
  el.style.left = `${x - 7 + scrollX}px`;
  el.style.top = `${y - 7 + scrollY}px`;
  el.style.transition = `opacity ${PRINTS.fade}s linear`;
  el.innerHTML = PAW;
  document.body.append(el);
  prints.push(el);
  if (prints.length > PRINTS.max) prints.shift()?.remove();
  setTimeout(() => (el.style.opacity = '0'), PRINTS.hold * 1000);
  setTimeout(() => {
    el.remove();
    const i = prints.indexOf(el);
    if (i >= 0) prints.splice(i, 1);
  }, (PRINTS.hold + PRINTS.fade) * 1000);
}

type SetMode = (mode: Mode) => void;

function throwCat(b: Brain, velocity: THREE.Vector2, setMode: SetMode) {
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

interface Layers {
  hitbox: RefObject<HTMLDivElement | null>;
  cursor: RefObject<HTMLDivElement | null>;
  fish: RefObject<HTMLDivElement | null>;
  bubble: RefObject<HTMLDivElement | null>;
  beam: RefObject<HTMLDivElement | null>;
}

/** Decides what the cat does each frame and writes it into the pose, the root group and the DOM layers. */
function Director({
  brain,
  pose,
  root,
  layers,
  setMode,
}: {
  brain: RefObject<Brain>;
  pose: RefObject<Pose>;
  root: RefObject<THREE.Group | null>;
  layers: Layers;
  setMode: SetMode;
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
    const ease = (rate: number) => (b.reduced ? 1 : 1 - Math.exp(-dt * rate));

    b.pet *= Math.exp(-dt * PET.decay);

    // 1. Behaviour: decide and move.
    let speed = 0;
    let bob = 0;
    let hop = 0;
    let purr = 0;
    g.visible = b.mode !== 'away';

    // The fish shows up now and then while you're around.
    if (
      !b.reduced &&
      (b.mode === 'rest' || b.mode === 'walk') &&
      t > b.nextFishAt &&
      b.pointerSeen &&
      t - b.lastInput < 10 &&
      !b.hoverMascot &&
      document.visibilityState === 'visible'
    ) {
      document.documentElement.dataset.fishCursor = '';
      setMode('chase');
    }

    switch (b.mode) {
      case 'rest': {
        b.pos.lerp(b.spot, ease(10));
        b.rot += (0 - b.rot) * ease(10);
        if (b.pet > PET.nap) {
          b.napUntil = t + NAP_FOR;
          setMode('nap');
        } else if (!b.reduced && t > b.restUntil && !b.hoverMascot && b.pet < PET.purr) {
          // Light mode: sometimes walk up to a card and scratch it, or scratch/doodle right here.
          const urge = b.dark ? 1 : Math.random();
          const plan = urge < SCRATCH_CHANCE ? planScratch(vw, vh) : null;
          if (plan) {
            b.scratch = plan;
            b.target.copy(plan.stand);
            b.after = 'scratch';
            setMode('walk');
            break;
          }
          if (urge < SCRATCH_CHANCE + 0.2) {
            b.scratch = { card: null, side: Math.random() < 0.5 ? 'left' : 'right', stand: b.pos.clone() };
            setMode('scratch');
            break;
          }
          // Wander: anywhere at random, back home, or stay a bit longer.
          const roll = Math.random();
          const next = roll < 0.75 ? findSpot(vw, vh) : roll < 0.9 ? home.clone() : null;
          if (next && next.distanceTo(b.pos) > 40) {
            b.target.copy(next);
            setMode('walk');
          } else b.restUntil = t + between(REST);
        }
        break;
      }
      case 'walk': {
        const to = b.target.clone().sub(b.pos);
        const dist = to.length();
        if (b.hoverMascot || b.pet > PET.purr) {
          // Being stroked: stop right here.
          b.after = 'rest';
          b.spot.copy(b.pos);
          b.restUntil = t + between(REST);
          setMode('rest');
          break;
        }
        if (dist < 3) {
          b.spot.copy(b.target);
          b.restUntil = t + between(REST);
          setMode(b.after === 'scratch' && b.scratch ? 'scratch' : 'rest');
          b.after = 'rest';
          break;
        }
        speed = WALK_SPEED;
        b.pos.addScaledVector(to.normalize(), Math.min(dist, WALK_SPEED * dt));
        break;
      }
      case 'scratch': {
        b.pos.lerp(b.spot, ease(10));
        if (t - b.modeAt > SCRATCH_FOR) {
          if (b.scratch) markAt(b.scratch, b.pos);
          b.scratch = null;
          b.restUntil = t + between(REST);
          b.forced = { face: 'happy', until: t + 0.8 };
          setMode('rest');
        }
        break;
      }
      case 'nap': {
        b.pos.lerp(b.spot, ease(10));
        if (t > b.napUntil) {
          b.pet = 0;
          b.restUntil = t + between(REST);
          setMode('rest');
        }
        break;
      }
      case 'chase': {
        // Run until the mouth (head centre) reaches the fish.
        const to = new THREE.Vector2(b.pointer.x, b.pointer.y).sub(b.pos);
        const dist = to.length();
        if (dist < 34) {
          setMode('eat');
          break;
        }
        if (t - b.modeAt > CHASE_TIMEOUT) {
          delete document.documentElement.dataset.fishCursor;
          b.nextFishAt = t + between(FISH_EVERY);
          b.spot.copy(b.pos);
          b.restUntil = t + between(REST);
          b.forced = { face: 'sleepy', until: t + 1.5 };
          setMode('rest');
          break;
        }
        speed = RUN_SPEED;
        b.pos.addScaledVector(to.normalize(), Math.min(dist, RUN_SPEED * dt));
        break;
      }
      case 'eat': {
        if (t - b.modeAt > EAT_FOR) {
          delete document.documentElement.dataset.fishCursor;
          b.nextFishAt = t + between(FISH_EVERY);
          b.spot.copy(b.pos);
          // A full belly: content, then a nap.
          b.forced = { face: 'love', until: t + 1.2 };
          b.napUntil = t + 1.2 + NAP_FOR * 0.6;
          setMode('nap');
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
          b.spot.copy(home);
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
          b.restUntil = t + between(REST);
          setMode('rest');
        }
        break;
      }
    }

    const grounded =
      b.mode === 'rest' || b.mode === 'walk' || b.mode === 'scratch' || b.mode === 'nap' || b.mode === 'eat' || b.mode === 'chase';
    if (grounded && !b.reduced) {
      if (speed > 0) {
        b.step += dt * speed * 0.08;
        bob = -Math.abs(Math.sin(b.step)) * (speed > WALK_SPEED ? 8 : 4);
      } else if (b.mode !== 'nap') {
        bob = Math.sin(t * 2.2) * (t - b.lastInput > 60 ? 2 : 4);
      }
      const since = t - b.hopAt;
      if (since < 0.35) hop = -Math.sin((since / 0.35) * Math.PI) * 22;
      if (b.pet > PET.purr && b.mode !== 'nap') purr = Math.sin(t * 70) * 1.2;
    }

    // Paw prints behind it while it walks or runs.
    if (grounded && speed > 0 && !b.reduced) {
      b.trail += speed * dt;
      if (b.trail > PRINTS.stride) {
        b.trail = 0;
        b.foot = b.foot === 1 ? -1 : 1;
        const feet = boxAt(b.pos).bottom - 4;
        pawPrint(b.pos.x + b.foot * 9, feet + (b.foot === 1 ? 0 : 4));
      }
    }

    // Dark mode flashlight: it decides where to look (ahead while walking, else looks around).
    const flashlight = b.dark && !b.reduced && (b.mode === 'rest' || b.mode === 'walk');
    if (flashlight) {
      if (b.mode === 'walk') {
        b.aimGoal.copy(b.target).sub(b.pos).setLength(320).add(b.pos);
        b.aimGoal.y += 80;
      } else if (t > b.aimUntil) {
        b.aimGoal.set(80 + Math.random() * (vw - 160), 140 + Math.random() * (vh - 220));
        b.aimUntil = t + between(LOOK_AROUND);
      }
      b.aim.lerp(b.aimGoal, 1 - Math.exp(-dt * 2.5));
    }

    // 2. Gaze and face.
    const target = b.mode === 'chase' ? b.pointer : flashlight ? b.aim : (b.hoverTarget ?? b.pointer);
    const lookX = clamp((target.x - b.pos.x) / 450);
    const lookY = clamp((target.y - b.pos.y) / 450);

    let face: Face = 'idle';
    const idleFor = t - b.lastInput;
    if (b.mode === 'grab') face = 'angry';
    else if (b.mode === 'thrown' || b.mode === 'away') face = 'surprised';
    else if (b.mode === 'return' || t < b.dizzyUntil) face = 'dizzy';
    else if (b.mode === 'eat') face = Math.floor((t - b.modeAt) * 8) % 2 ? 'surprised' : 'happy';
    else if (b.mode === 'chase' || b.mode === 'scratch') face = 'excited';
    else if (b.forced && t < b.forced.until) face = b.forced.face;
    else if (b.mode === 'nap') face = 'asleep';
    else if (b.pet > PET.sleepy) face = 'sleepy';
    else if (b.pet > PET.purr) face = 'love';
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
    p.headY += (lookX * 0.28 - p.headY) * ease(8);
    p.headX += (lookY * 0.18 - p.headX) * ease(8);
    if (face === 'angry' && !b.reduced) p.headY += Math.sin(t * 40) * 0.1;
    if (b.mode === 'eat' && !b.reduced) p.headX += Math.sin(t * 30) * 0.08;

    // Facing: turn toward where it walks or runs, back to the front when it stops.
    const heading =
      b.mode === 'walk'
        ? b.target.x - b.pos.x
        : b.mode === 'chase'
          ? b.pointer.x - b.pos.x
          : b.mode === 'scratch' && b.scratch
            ? b.scratch.side === 'left' ? 1 : -1
            : 0;
    p.facing += (Math.sign(Math.round(heading)) * 0.75 - p.facing) * ease(6);
    p.lie += ((b.mode === 'nap' ? 1 : 0) - p.lie) * ease(5);
    p.tailSpeed = b.mode === 'chase' ? 3 : b.pet > PET.purr ? 0.4 : 1;

    const walking = speed > 0 && !b.reduced;
    const swing = walking ? Math.sin(b.step) : 0;
    p.legL += ((walking ? swing * 0.7 : 0) - p.legL) * ease(20);
    p.legR += ((walking ? -swing * 0.7 : 0) - p.legR) * ease(20);

    const sway = b.reduced ? 0 : Math.sin(t * 1.6) * 0.08;
    let armL = walking ? swing * 0.35 : -sway;
    let armR = walking ? -swing * 0.35 : sway;
    if (b.mode === 'grab') {
      armR = 2.7;
      armL = -0.9 + Math.sin(t * 22) * 0.45;
    } else if (b.mode === 'thrown' || b.mode === 'away') {
      armR = 2.6;
      armL = -2.6;
    } else if (b.mode === 'chase') {
      armR = 1.2 + swing * 0.3;
      armL = -1.2 - swing * 0.3;
    } else if (b.mode === 'eat') {
      armR = 1.6;
      armL = -1.6;
    } else if (b.mode === 'scratch') {
      // Quick alternating swipes.
      const swipe = Math.sin((t - b.modeAt) * 26);
      armR = 1.9 + swipe * 0.7;
      armL = -1.9 + swipe * 0.7;
    } else if (face === 'happy') {
      armR = 2.5 + Math.sin(t * 14) * 0.35;
    } else if (face === 'excited') {
      armR = 0.7;
      armL = -0.7;
    }
    // Dark mode: the right paw holds a flashlight aimed at the cursor.
    p.flash = flashlight;
    if (p.flash) {
      const sx = b.pos.x + SHOULDER.right.x * SCALE;
      const sy = b.pos.y - SHOULDER.right.y * SCALE;
      // Arm points along (sin θ, -cos θ) in y-up space; the aim is (dx, dy) in y-down screen space.
      armR = Math.atan2(b.aim.x - sx, b.aim.y - sy);
    }
    p.armL += (armL - p.armL) * ease(14);
    p.armR += (armR - p.armR) * ease(14);

    // 4. Write to the scene and the DOM layers.
    const y = b.pos.y + bob + hop + p.lie * 30 * SCALE;
    g.position.set(b.pos.x + purr - vw / 2, vh / 2 - y, 0);
    g.rotation.z = -b.rot;

    const { hitbox, cursor, fish, bubble, beam } = layers;
    if (beam.current) {
      beam.current.style.display = p.flash ? 'block' : 'none';
      if (p.flash) {
        // A blocky cone from the lens to a square spot around the cursor.
        const off = pawOffset(p.armR, 34);
        const a = new THREE.Vector2(b.pos.x + off.x, y + off.y);
        const c = b.aim.clone();
        const dir = c.clone().sub(a);
        if (dir.lengthSq() < 1) dir.set(1, 0);
        dir.normalize();
        const n = new THREE.Vector2(-dir.y, dir.x);
        const pt = (v: THREE.Vector2) => `${v.x.toFixed(1)}px ${v.y.toFixed(1)}px`;
        const far = c.clone().addScaledVector(dir, BEAM.spot);
        beam.current.style.clipPath = `polygon(${[
          a.clone().addScaledVector(n, BEAM.start),
          c.clone().addScaledVector(n, BEAM.spot),
          far.clone().addScaledVector(n, BEAM.spot),
          far.clone().addScaledVector(n, -BEAM.spot),
          c.clone().addScaledVector(n, -BEAM.spot),
          a.clone().addScaledVector(n, -BEAM.start),
        ]
          .map(pt)
          .join(', ')})`;
      }
    }
    if (hitbox.current) {
      const box = boxAt(new THREE.Vector2(b.pos.x, y));
      hitbox.current.style.transform = `translate(${box.left}px, ${box.top}px)`;
      const touchable = b.mode === 'rest' || b.mode === 'walk' || b.mode === 'nap';
      hitbox.current.style.pointerEvents = touchable ? 'auto' : 'none';
    }
    if (cursor.current) {
      const off = pawOffset(p.armR);
      cursor.current.style.transform = `translate(${b.pos.x + off.x}px, ${y + off.y}px)`;
    }
    if (fish.current) {
      const eating = b.mode === 'eat';
      const fx = eating ? b.pos.x : b.pointer.x;
      const fy = eating ? y + 10 : b.pointer.y;
      const shrink = eating ? Math.max(0, 1 - (t - b.modeAt) / EAT_FOR) : 1;
      fish.current.style.transform = `translate(${fx}px, ${fy}px) scale(${shrink})`;
    }
    if (bubble.current) {
      const box = boxAt(new THREE.Vector2(b.pos.x, y));
      bubble.current.style.transform = `translate(${box.right - 8}px, ${box.top - 6}px)`;
    }
  });

  return null;
}

/** Pixel fish that replaces the cursor while the cat hunts. */
function FishCursor() {
  return (
    <svg width="40" height="24" viewBox="0 0 20 12" shapeRendering="crispEdges" className="-translate-x-1/2 -translate-y-1/2" aria-hidden="true">
      <g className="fill-foreground">
        <rect x="3" y="1" width="12" height="10" />
        <rect x="15" y="3" width="2" height="6" />
        <rect x="0" y="0" width="3" height="4" />
        <rect x="0" y="8" width="3" height="4" />
        <rect x="2" y="4" width="2" height="4" />
      </g>
      <g className="fill-secondary">
        <rect x="4" y="2" width="10" height="8" />
        <rect x="14" y="4" width="2" height="4" />
        <rect x="1" y="1" width="1" height="2" />
        <rect x="1" y="9" width="1" height="2" />
      </g>
      <rect x="11" y="4" width="2" height="2" className="fill-primary" />
      <rect x="7" y="2" width="1" height="8" className="fill-primary" />
    </svg>
  );
}

export default function Mascot() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const brain = useRef<Brain>(
    (() => {
      const home = homeOf(innerHeight);
      const t = now();
      return {
        reduced,
        mode: 'rest',
        modeAt: t,
        pos: home.clone(),
        spot: home.clone(),
        target: home.clone(),
        restUntil: t + between(REST),
        napUntil: 0,
        vel: new THREE.Vector2(),
        rot: 0,
        spin: 0,
        step: 0,
        pointer: { x: innerWidth / 2, y: innerHeight / 2 },
        pointerSeen: false,
        samples: [],
        lastInput: t,
        hoverMascot: false,
        hoverTarget: null,
        pet: 0,
        clicks: [],
        forced: null,
        hopAt: -10,
        surprisedUntil: 0,
        dizzyUntil: 0,
        reading: false,
        nextFishAt: t + between(FISH_EVERY),
        dark: document.documentElement.classList.contains('dark'),
        after: 'rest',
        scratch: null,
        trail: 0,
        foot: 1,
        aim: new THREE.Vector2(innerWidth / 2, innerHeight / 2),
        aimGoal: new THREE.Vector2(innerWidth / 2, innerHeight / 2),
        aimUntil: 0,
      } satisfies Brain;
    })(),
  );
  const pose = useRef<Pose>({
    headX: 0,
    headY: 0,
    armL: 0,
    armR: 0,
    legL: 0,
    legR: 0,
    lie: 0,
    facing: 0,
    time: 0,
    tailSpeed: 1,
    flash: false,
    face: 'idle',
    shiftX: 0,
    shiftY: 0,
  });
  const root = useRef<THREE.Group>(null);
  const layers: Layers = {
    hitbox: useRef<HTMLDivElement>(null),
    cursor: useRef<HTMLDivElement>(null),
    fish: useRef<HTMLDivElement>(null),
    bubble: useRef<HTMLDivElement>(null),
    beam: useRef<HTMLDivElement>(null),
  };
  const [mode, setModeState] = useState<Mode>('rest');
  const [colors, setColors] = useState<ThemeColors>(readThemeColors);

  const setMode: SetMode = (next) => {
    const b = brain.current;
    b.mode = next;
    b.modeAt = now();
    setModeState(next);
  };

  useEffect(() => {
    const b = brain.current;
    // Dev only: inspect the cat from the console (`__mascot.mode`, `__mascot.nextFishAt = 0`).
    if (import.meta.env.DEV) (window as unknown as { __mascot: Brain }).__mascot = b;
    let lastScroll = scrollY;
    let lastScrollAt = now();

    const onMove = (e: PointerEvent) => {
      const t = now();
      const dx = e.clientX - b.pointer.x;
      const dy = e.clientY - b.pointer.y;
      b.pointer = { x: e.clientX, y: e.clientY };
      b.pointerSeen = true;
      b.lastInput = t;
      // Stroking: cursor travel while it's over the cat.
      if (b.hoverMascot && (b.mode === 'rest' || b.mode === 'walk' || b.mode === 'nap')) b.pet += Math.min(80, Math.hypot(dx, dy));
      if (b.mode !== 'grab') return;
      b.samples.push({ x: e.clientX, y: e.clientY, t });
      b.samples = b.samples.filter((s) => t - s.t < 0.8);
      if (isShake(b.samples)) {
        const recent = b.samples.filter((s) => t - s.t < 0.1);
        const first = recent[0] ?? b.samples[0]!;
        const dt = Math.max(0.016, t - first.t);
        throwCat(b, new THREE.Vector2((e.clientX - first.x) / dt, (e.clientY - first.y) / dt), setMode);
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
      if (e.key === 'Escape' && b.mode === 'grab') throwCat(b, new THREE.Vector2(0, -1400), setMode);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('keydown', onKey);

    const writing = document.getElementById('writing');
    const io = new IntersectionObserver(([entry]) => void (b.reading = !!entry?.isIntersecting), { threshold: 0.35 });
    if (writing) io.observe(writing);

    const theme = new MutationObserver(() => {
      b.dark = document.documentElement.classList.contains('dark');
      setColors(readThemeColors());
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      removeEventListener('scroll', onScroll);
      removeEventListener('keydown', onKey);
      io.disconnect();
      theme.disconnect();
      delete document.documentElement.dataset.fishCursor;
    };
    // setMode only touches refs and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = () => {
    const b = brain.current;
    const t = now();
    b.lastInput = t;
    if (b.mode === 'nap') {
      // Woken up.
      b.pet = 0;
      b.restUntil = t + between(REST);
      b.forced = { face: 'surprised', until: t + 0.6 };
      setMode('rest');
      return;
    }
    b.clicks = [...b.clicks.filter((c) => t - c < CLICK_WINDOW), t];
    const n = b.clicks.length;
    if (n >= CLICKS_TO_ANGER && !b.reduced) {
      b.clicks = [];
      b.samples = [];
      setMode('grab');
    } else if (n >= 3) {
      b.forced = { face: 'angry', until: t + 0.9 };
    } else {
      b.forced = { face: 'happy', until: t + 0.8 };
      b.hopAt = t;
    }
  };

  const flying = mode === 'grab' || mode === 'thrown' || mode === 'away' || mode === 'chase' || mode === 'eat';

  return (
    <div data-mascot aria-hidden="true">
      {/* Dark mode flashlight: inside the beam the page is inverted back to (roughly) light mode. */}
      <div
        ref={layers.beam}
        className="pointer-events-none fixed inset-0 z-44 hidden backdrop-invert backdrop-hue-rotate-180"
      />
      <div className={`pointer-events-none fixed inset-0 ${flying ? 'z-97' : 'z-45'}`}>
        <Canvas
          orthographic
          flat
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 1000], zoom: 1, near: 1, far: 3000 }}
          gl={{ alpha: true, antialias: true }}
          // R3F makes its own wrapper `pointer-events: auto`; the page underneath must stay clickable.
          style={{ pointerEvents: 'none' }}
        >
          <Director brain={brain} pose={pose} root={root} layers={layers} setMode={setMode} />
          <group ref={root} scale={SCALE}>
            <Model pose={pose} colors={colors} shadow />
            <Model pose={pose} colors={colors} shadow={false} />
          </group>
        </Canvas>
      </div>
      {/* Click/stroke target that follows the cat (the canvas itself never takes pointer events). */}
      <div
        ref={layers.hitbox}
        onClick={onClick}
        onPointerEnter={() => void (brain.current.hoverMascot = true)}
        onPointerLeave={() => void (brain.current.hoverMascot = false)}
        className="fixed top-0 left-0 z-46 cursor-pointer"
        style={{ width: (BOUNDS.x1 - BOUNDS.x0) * SCALE, height: (BOUNDS.y1 - BOUNDS.y0) * SCALE }}
      />
      {(mode === 'chase' || mode === 'eat') && (
        <div ref={layers.fish} className="pointer-events-none fixed top-0 left-0 z-99">
          <FishCursor />
        </div>
      )}
      {mode === 'eat' && (
        <div ref={layers.bubble} className="pointer-events-none fixed top-0 left-0 z-99">
          <span className="inline-block -rotate-6 border-(length:--border-width-sm) border-border bg-card px-2 font-hand text-2xl leading-tight text-card-foreground shadow-brutal-sm">
            nom nom
          </span>
        </div>
      )}
      {mode === 'grab' && (
        <>
          {/* While it holds the cursor: the page can't be clicked and the real cursor is hidden. */}
          <div className="fixed inset-0 z-98 cursor-none" onClick={(e) => e.preventDefault()} />
          <div ref={layers.cursor} className="pointer-events-none fixed top-0 left-0 z-99">
            <svg width="22" height="28" viewBox="0 0 11 14" shapeRendering="crispEdges" className="-translate-x-0.5 -translate-y-0.5">
              <path
                d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-4v1h1v1h1v1h-2v1h-2v-1h-1v-1h-1v1h-1v1h-1z"
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
