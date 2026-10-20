import { gsap } from 'gsap';
import { num, svgRect, tween, wait } from './runtime';

const STEP = 0.32;
const LEASE = 4.4;
const BACKOFF = [0.25, 0.5, 1];
const MAX_QUEUE = 5;

interface Worker {
  id: number;
  g: SVGGElement;
  job: SVGRectElement;
  squares: SVGRectElement[];
  lease: SVGRectElement;
  status: SVGTextElement;
}

/**
 * Three Go workers lease jobs from a Postgres queue and fan out per student.
 * W2 dies on every other job: its lease runs out and the job returns to the queue.
 * W3 hits a failing student and retries it with exponential backoff.
 */
export function leaseRetry(root: HTMLElement, whenVisible: () => Promise<void>) {
  const slots = Array.from(root.querySelectorAll<SVGRectElement>('[data-slot]'));
  const flying = root.querySelector('[data-flying]')!;
  const workers: Worker[] = Array.from(root.querySelectorAll<SVGGElement>('[data-worker]')).map((g, id) => ({
    id,
    g,
    job: g.querySelector('[data-job]')!,
    squares: Array.from(g.querySelectorAll<SVGRectElement>('[data-square]')),
    lease: g.querySelector('[data-lease]')!,
    status: g.querySelector('[data-status]')!,
  }));
  let queued = 3;

  const renderQueue = () => slots.forEach((slot, i) => slot.setAttribute('visibility', i < queued ? 'visible' : 'hidden'));
  const say = (w: Worker, text: string) => (w.status.textContent = text);
  const reset = (w: Worker) => {
    w.g.setAttribute('opacity', '1');
    w.job.setAttribute('visibility', 'hidden');
    w.squares.forEach((s) => (s.style.fill = 'var(--card)'));
    w.lease.setAttribute('width', '0');
    say(w, 'Idle');
  };

  /** A job block flies between a queue slot and a worker. */
  async function fly(from: SVGRectElement, to: SVGRectElement) {
    const block = svgRect(
      { x: num(from, 'x'), y: num(from, 'y'), width: num(to, 'width'), height: num(to, 'height') },
      'fill:var(--accent);stroke:var(--foreground);stroke-width:2.5',
    );
    flying.append(block);
    await tween(block, { attr: { x: num(to, 'x'), y: num(to, 'y') }, duration: 0.35, ease: 'power3.inOut' });
    block.remove();
  }

  async function claim(w: Worker) {
    while (queued === 0) await wait(0.2);
    queued--;
    const top = slots[0]!;
    renderQueue();
    say(w, 'Claim');
    await fly(top, w.job);
    w.job.setAttribute('visibility', 'visible');
  }

  async function giveBack(w: Worker) {
    w.job.setAttribute('visibility', 'hidden');
    const slot = slots[Math.min(queued, MAX_QUEUE - 1)]!;
    await fly(w.job, slot);
    queued = Math.min(MAX_QUEUE, queued + 1);
    renderQueue();
  }

  async function run(w: Worker) {
    await wait(w.id * 0.5);
    for (let n = 1; ; n++) {
      await whenVisible();
      await claim(w);
      say(w, 'Leased');
      const max = num(w.lease, 'data-max');
      const lease = gsap.fromTo(w.lease, { attr: { width: 0 } }, { attr: { width: max }, duration: LEASE, ease: 'none' });
      const dies = w.id === 1 && n % 2 === 0;
      const flaky = w.id === 2;
      let died = false;

      for (let j = 0; j < w.squares.length; j++) {
        if (dies && j === 2) {
          died = true;
          w.g.setAttribute('opacity', '0.45');
          say(w, '✕ Died');
          await lease.then();
          say(w, 'Lease expired');
          await giveBack(w);
          await wait(0.5);
          say(w, 'Restart');
          await wait(0.5);
          break;
        }
        await wait(STEP);
        if (flaky && j === 3) {
          w.squares[j]!.style.fill = 'var(--destructive)';
          for (let r = 0; r < BACKOFF.length; r++) {
            say(w, `Retry ${'·'.repeat(r + 1)}`);
            await wait(BACKOFF[r]!);
          }
          say(w, 'Leased');
        }
        w.squares[j]!.style.fill = 'var(--foreground)';
      }

      lease.kill();
      if (!died) {
        say(w, 'Done ✓');
        await wait(0.6);
      }
      reset(w);
      await wait(0.3);
    }
  }

  /** New screening jobs keep arriving. */
  async function produce() {
    for (;;) {
      await whenVisible();
      await wait(1.1);
      if (queued < MAX_QUEUE) {
        queued++;
        renderQueue();
        const slot = slots[queued - 1]!;
        gsap.from(slot, { attr: { y: num(slot, 'y') - 10 }, duration: 0.2, ease: 'power2.out' });
      }
    }
  }

  workers.forEach(reset);
  renderQueue();
  workers.forEach((w) => void run(w));
  void produce();
}
