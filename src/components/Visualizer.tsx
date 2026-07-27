import { useEffect, useRef } from 'react';
import type { Step } from '../engine/types';
import { renderStep } from './renderers/render';

interface Props {
  step: Step | null;
  prevStep: Step | null;
}

export function Visualizer({ step, prevStep }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hostRef.current) renderStep(hostRef.current, step, prevStep);
  }, [step, prevStep]);

  return <div className="viz-canvas" ref={hostRef} />;
}
