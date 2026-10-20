import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { visibility } from './artifacts/runtime';
import { seatBooking } from './artifacts/seat-booking';
import { leaseRetry } from './artifacts/lease-retry';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const OUT = 'expo.out';
const SOFT = 'quart.out';
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

/** Work figure (Fig.01): click a work card (or its tab) to watch that project's mechanism animation. */
function figure() {
  const fig = document.querySelector<HTMLElement>('[data-fig]');
  const section = document.getElementById('work');
  if (!fig || !section) return;
  const tabs = $$<HTMLButtonElement>('[data-view-tab]', section);
  const panels = $$('[data-view-panel]', fig);
  const cards = $$('[data-work-card]', section);
  const note = fig.querySelector('[data-view-note]');

  const show = (view: string) => {
    fig.dataset.view = view;
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.viewTab === view));
    for (const panel of panels) panel.hidden = panel.dataset.viewPanel !== view;
    for (const card of cards) card.dataset.active = String(card.dataset.workCard === view);
    const tab = tabs.find((t) => t.dataset.viewTab === view && t.dataset.note);
    if (note && tab?.dataset.note) note.textContent = tab.dataset.note;
    document.dispatchEvent(new CustomEvent('rp:view', { detail: view }));
  };

  for (const tab of tabs) tab.addEventListener('click', () => show(tab.dataset.viewTab!));
  // Whole card opens its animation on desktop; links and buttons inside keep their own behaviour.
  for (const card of cards)
    card.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a, button') || !matchMedia('(min-width: 48rem)').matches) return;
      show(card.dataset.workCard!);
    });
}

/** Experience timeline: the line fills with scroll and lights the dots it passes. */
function timeline() {
  const list = document.querySelector<HTMLElement>('[data-timeline]');
  const line = list?.querySelector<HTMLElement>('[data-timeline-line]');
  if (!list || !line) return;
  if (reduced) return; // markup already shows the finished state
  const dots = $$('[data-dot]', list);
  const update = (progress: number) => {
    gsap.set(line, { scaleY: progress });
    const r = list.getBoundingClientRect();
    const limit = r.top + 16 + progress * (r.height - 32);
    for (const dot of dots) dot.dataset.on = String(dot.getBoundingClientRect().top + 12 <= limit + 1);
  };
  ScrollTrigger.create({
    trigger: list,
    start: 'top 60%',
    end: 'bottom 60%',
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });
}

/** Mobile menu: close after picking a link, reveal on open. */
function menu() {
  const details = document.querySelector<HTMLDetailsElement>('[data-menu]');
  if (!details) return;
  for (const link of $$('a', details)) link.addEventListener('click', () => (details.open = false));
  const panel = details.querySelector('[data-menu-panel]');
  details.addEventListener('toggle', () => {
    if (details.open && panel && !reduced)
      gsap.fromTo(panel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.2, ease: OUT, clearProps: 'clipPath' });
  });
}

function intro() {
  gsap.from('[data-m="nav"]', { yPercent: -140, duration: 0.3, ease: OUT });
  $$('[data-m="line"]').forEach((el, i) =>
    gsap.fromTo(
      el,
      { clipPath: 'inset(100% -10% -20% -10%)', yPercent: 30 },
      { clipPath: 'inset(-20% -10% -20% -10%)', yPercent: 0, duration: 0.7, delay: 0.1 + i * 0.08, ease: SOFT, clearProps: 'clipPath,transform' },
    ),
  );
  const highlight = 0.69;
  $$('[data-m="hl"]').forEach((el, i) =>
    gsap.from(el, { scaleX: 0, duration: 0.3, delay: highlight + i * 0.08, ease: OUT, clearProps: 'transform' }),
  );
  // Highlighted words read in ink until their block lands behind them.
  $$('[data-m="hltext"]').forEach((el, i) => {
    el.style.color = 'var(--foreground)';
    gsap.delayedCall(highlight + i * 0.08 + 0.12, () => (el.style.color = ''));
  });
  $$('[data-m="rise"]').forEach((el, i) =>
    gsap.from(el, { y: 24, opacity: 0, duration: 0.5, delay: 0.45 + i * 0.06, ease: SOFT, clearProps: 'transform,opacity' }),
  );
}

/** Headings wipe in behind a yellow block, labels type out, grids stagger up. */
function reveals() {
  const hidden = 'inset(0% 100% 0% 0%)';
  const shown = 'inset(0% 0% 0% 0%)';
  const jobs: { el: HTMLElement; prep: () => void; clear: () => void; play: () => void }[] = [];

  for (const el of $$('[data-wipe]')) {
    const text = el.querySelector<HTMLElement>('[data-wipe-text]');
    if (!text) continue;
    jobs.push({
      el,
      prep: () => gsap.set(text, { clipPath: hidden }),
      clear: () => gsap.set(text, { clearProps: 'clipPath' }),
      play: () => {
        const block = document.createElement('span');
        block.setAttribute('aria-hidden', 'true');
        block.className = 'pointer-events-none absolute inset-y-0 -inset-x-[0.06em] border-(length:--border-width) border-border bg-primary';
        el.append(block);
        gsap
          .timeline({ onComplete: () => block.remove() })
          .fromTo(block, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.35, ease: OUT })
          .set(text, { clearProps: 'clipPath' })
          .set(block, { transformOrigin: 'right center' })
          .to(block, { scaleX: 0, duration: 0.35, ease: OUT });
      },
    });
  }

  for (const el of $$('[data-type]')) {
    const steps = Math.max(1, el.textContent?.trim().length ?? 1);
    jobs.push({
      el,
      prep: () => gsap.set(el, { clipPath: hidden }),
      clear: () => gsap.set(el, { clearProps: 'clipPath' }),
      play: () => gsap.to(el, { clipPath: shown, duration: steps * 0.032, ease: `steps(${steps})`, clearProps: 'clipPath' }),
    });
  }

  for (const el of $$('[data-stagger]')) {
    const children = Array.from(el.children);
    jobs.push({
      el,
      prep: () => gsap.set(children, { opacity: 0 }),
      clear: () => gsap.set(children, { clearProps: 'opacity' }),
      play: () =>
        gsap.fromTo(children, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: SOFT, clearProps: 'transform,opacity' }),
    });
  }

  const revealAll = () => jobs.forEach((job) => job.clear());
  if (document.visibilityState !== 'visible') return;
  addEventListener('beforeprint', revealAll);

  for (const job of jobs) {
    // Already scrolled past (e.g. deep link): leave it visible.
    if (job.el.getBoundingClientRect().bottom <= 0) continue;
    job.prep();
    ScrollTrigger.create({ trigger: job.el, start: 'top 92%', once: true, onEnter: job.play });
  }
}

/** Marquee drifts left and speeds up with scroll velocity. */
function marquee() {
  const track = document.querySelector<HTMLElement>('[data-marquee]');
  if (!track) return;
  let x = 0;
  let velocity = 0;
  let lastY = scrollY;
  gsap.ticker.add((_time, deltaMs) => {
    const dt = Math.min(50, deltaMs) / 1000;
    if (dt <= 0) return;
    const y = scrollY;
    velocity += (Math.min((Math.abs(y - lastY) / dt) * 0.15, 320) - velocity) * 0.08;
    lastY = y;
    const half = track.scrollWidth / 2;
    if (half > 0) {
      x = (x - (70 + velocity) * dt) % half;
      gsap.set(track, { x });
    }
  });
}

/** Card colour strips re-wipe on hover. */
function cards() {
  for (const card of $$('[data-card]')) {
    const strip = card.querySelector('[data-strip]');
    if (!strip) continue;
    card.addEventListener('mouseenter', () =>
      gsap.fromTo(strip, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.25, ease: OUT, clearProps: 'clipPath' }),
    );
  }
}

/** Per-project mechanism animations. With reduced motion the still frame in the markup stays. */
function artifacts() {
  const mounts: Record<string, (root: HTMLElement, whenVisible: () => Promise<void>) => void> = {
    'seat-booking': seatBooking,
    'lease-retry': leaseRetry,
  };
  for (const root of $$('[data-artifact]')) mounts[root.dataset.artifact!]?.(root, visibility(root));
}

figure();
timeline();
menu();
if (!reduced) {
  intro();
  reveals();
  marquee();
  cards();
  artifacts();
}
