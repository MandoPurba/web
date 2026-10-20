import { useEffect, useState, type ComponentType } from 'react';

/**
 * Fixed, decorative layer behind homepage content (above section backgrounds, below content).
 * Hydrated with `client:media` (desktop only); loads Three.js when the browser is idle and WebGL exists.
 */
export default function SceneIsland() {
  const [Scene, setScene] = useState<ComponentType | null>(null);

  useEffect(() => {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) return;
    let cancelled = false;
    const load = () =>
      import('./BackgroundScene').then((module) => {
        if (!cancelled) setScene(() => module.default);
      });
    const idle = typeof requestIdleCallback === 'function';
    const handle = idle ? requestIdleCallback(load, { timeout: 2500 }) : window.setTimeout(load, 800);
    return () => {
      cancelled = true;
      if (idle) cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      {Scene && <Scene />}
    </div>
  );
}
