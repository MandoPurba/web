import { gsap } from 'gsap';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export const wait = (seconds: number) => new Promise<void>((resolve) => gsap.delayedCall(seconds, resolve));

export const tween = (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
  new Promise<void>((resolve) => gsap.to(target, { ...vars, onComplete: resolve }));

/** Resolves immediately while `el` is on screen (and not hidden); otherwise when it next becomes visible. */
export function visibility(el: Element) {
  let visible = false;
  let waiting: (() => void)[] = [];
  new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible) {
      waiting.forEach((resume) => resume());
      waiting = [];
    }
  }).observe(el);
  return () => (visible ? Promise.resolve() : new Promise<void>((resume) => waiting.push(resume)));
}

export function svgRect(attrs: Record<string, string | number>, style = '') {
  const rect = document.createElementNS(SVG_NS, 'rect');
  for (const [key, value] of Object.entries(attrs)) rect.setAttribute(key, String(value));
  rect.setAttribute('vector-effect', 'non-scaling-stroke');
  rect.setAttribute('style', style);
  return rect;
}

export const num = (el: Element, attr: string) => Number(el.getAttribute(attr));
