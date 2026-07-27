import { useEffect, useRef } from 'react';
import type { Step } from '../engine/types';

// Lazy-load the D3 renderer (and D3 itself) so it isn't in the initial bundle;
// it's only needed once there's a step to draw. Cached after first import.
let renderModule: typeof import('./renderers/render') | null = null;

interface Props {
  step: Step | null;
  prevStep: Step | null;
}

export function Visualizer({ step, prevStep }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!renderModule) renderModule = await import('./renderers/render');
      if (!cancelled && hostRef.current) renderModule.renderStep(hostRef.current, step, prevStep);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, prevStep]);

  return <div className="viz-canvas" ref={hostRef} />;
}
