import { useEffect, useState, type ComponentType } from 'react';

/** Loads the Three.js scene on desktop with WebGL only; otherwise the static SVG behind it stays. */
export default function IsoSceneIsland() {
  const [Scene, setScene] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!matchMedia('(min-width: 48rem)').matches) return;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) return;
    let cancelled = false;
    import('./IsoScene').then((module) => {
      if (!cancelled) setScene(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Always render an element: `client:visible` observes the island's children to decide when to hydrate.
  return <div className="absolute inset-0">{Scene && <Scene />}</div>;
}
