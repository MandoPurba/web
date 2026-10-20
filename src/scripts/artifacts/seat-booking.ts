import { gsap } from 'gsap';
import { num, svgRect, tween, wait } from './runtime';

type Seat = 'free' | 'locked' | 'held' | 'booked';

const FILL: Record<Seat, string> = {
  free: 'var(--card)',
  locked: 'var(--primary)',
  held: 'var(--primary)',
  booked: 'var(--secondary)',
};
/** A 2-hour hold, sped up. */
const HOLD = 3.2;
const PACKET = 12;
const BURST_EVERY = 1.4;

/**
 * Bursts of three concurrent requests all aim at the first free seat.
 * The first locks it; the others skip the locked row and take the next free one (FOR UPDATE SKIP LOCKED).
 * Each claim is held, then becomes booked (paid) or is reclaimed (unpaid).
 */
export function seatBooking(root: HTMLElement, whenVisible: () => Promise<void>) {
  const seats = Array.from(root.querySelectorAll<SVGRectElement>('[data-seat]'));
  const timers = Array.from(root.querySelectorAll<SVGRectElement>('[data-timer]'));
  const lanes = Array.from(root.querySelectorAll<SVGGElement>('[data-lane]')).map((lane) => num(lane, 'data-y'));
  const packets = root.querySelector('[data-packets]')!;
  const size = num(seats[0]!, 'width');
  const state: Seat[] = seats.map(() => 'free');
  let claims = 0;

  const set = (i: number, s: Seat) => {
    state[i] = s;
    seats[i]!.style.fill = FILL[s];
  };
  const center = (i: number) => ({ x: num(seats[i]!, 'x') + size / 2 - PACKET / 2, y: num(seats[i]!, 'y') + size / 2 - PACKET / 2 });

  seats.forEach((_, i) => set(i, 'free'));
  timers.forEach((t) => t.setAttribute('width', '0'));

  async function hold(i: number) {
    set(i, 'held');
    timers[i]!.setAttribute('width', String(size));
    await tween(timers[i]!, { attr: { width: 0 }, duration: HOLD, ease: 'none' });
    // Every third claim never pays: its seat is reclaimed.
    if (claims++ % 3 === 2) {
      seats[i]!.style.fill = 'var(--destructive)';
      await wait(0.16);
      set(i, 'free');
    } else set(i, 'booked');
  }

  /** Request `k` of a burst: walks the free seats in order, skipping ones locked before it got there. */
  async function request(k: number, path: number[]) {
    const start = { x: 54, y: lanes[k]! - PACKET / 2 };
    const packet = svgRect(
      { x: start.x, y: start.y, width: PACKET, height: PACKET },
      'fill:var(--primary);stroke:var(--foreground);stroke-width:2',
    );
    packets.append(packet);
    const first = center(path[0]!);
    await tween(packet, { attr: first, duration: 0.45 + k * 0.08, ease: 'power2.out' });
    for (const seat of path.slice(1)) {
      // Locked by an earlier request in this burst → skip, don't wait for it.
      const next = center(seat);
      const at = { x: num(packet, 'x'), y: num(packet, 'y') };
      await tween(packet, {
        keyframes: [
          { attr: { x: (at.x + next.x) / 2, y: Math.min(at.y, next.y) - 16 }, duration: 0.11, ease: 'power2.out' },
          { attr: next, duration: 0.11, ease: 'power2.in' },
        ],
      });
    }
    packet.remove();
    void hold(path.at(-1)!);
  }

  async function newSession() {
    await wait(0.8);
    seats.forEach((_, i) => gsap.delayedCall(i * 0.04, () => set(i, 'free')));
    await wait(seats.length * 0.04 + 0.6);
  }

  async function loop() {
    for (;;) {
      await whenVisible();
      const free = state.flatMap((s, i) => (s === 'free' ? [i] : []));
      if (free.length < lanes.length) {
        if (!state.includes('held') && !state.includes('locked')) await newSession();
        else await wait(0.3);
        continue;
      }
      const targets = free.slice(0, lanes.length);
      // All three race for the same first seat; request k ends on the k-th free seat.
      // Reserve without painting: a seat lights up when its request lands.
      targets.forEach((seat) => (state[seat] = 'locked'));
      await Promise.all(targets.map((_, k) => request(k, targets.slice(0, k + 1))));
      await wait(BURST_EVERY);
    }
  }

  void loop();
}
