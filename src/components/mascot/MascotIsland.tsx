import { useEffect, useState, type ComponentType } from 'react';

/** Desktop-only (`client:media`); loads the Three.js mascot when the browser is idle and WebGL exists. */
export default function MascotIsland() {
  const [Mascot, setMascot] = useState<ComponentType | null>(null);

  useEffect(() => {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) return;
    let cancelled = false;
    const load = () =>
      import('./Mascot').then((module) => {
        if (!cancelled) setMascot(() => module.default);
      });
    const idle = typeof requestIdleCallback === 'function';
    const handle = idle ? requestIdleCallback(load, { timeout: 3000 }) : window.setTimeout(load, 1000);
    return () => {
      cancelled = true;
      if (idle) cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return Mascot ? <Mascot /> : <div hidden />;
}
