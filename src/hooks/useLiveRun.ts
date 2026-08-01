// Re-runs the user's code shortly after they stop typing and hands back a
// traced result for the visualization.
//
// Three things make this feel calm rather than twitchy:
//   - Debounce, so nothing runs mid-keystroke.
//   - Half-written code is expected, not exceptional: when a run fails, the
//     previous good result stays on screen instead of flashing an error.
//   - Every run is tagged with a generation and given an AbortSignal, so a slow
//     Python run that finishes late can never overwrite a newer result.

import { useEffect, useRef, useState } from 'react';
import { runForPreview } from '../engine/runner';
import type { Language, RunResult } from '../engine/types';

const DEBOUNCE_MS = 500;

export interface LiveRunState {
  /** Most recent successful run; retained while newer code is broken. */
  result: RunResult | null;
  running: boolean;
  /** Set when the latest attempt failed, for a subtle inline hint. */
  staleReason: string | null;
}

interface Params {
  code: string;
  language: Language;
  entryFunction: string;
  argsJson: string;
  enabled: boolean;
}

export function useLiveRun({ code, language, entryFunction, argsJson, enabled }: Params): LiveRunState {
  const [state, setState] = useState<LiveRunState>({ result: null, running: false, staleReason: null });

  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !code.trim() || !entryFunction.trim()) return;

    const timer = window.setTimeout(async () => {
      // Supersede any in-flight run before starting a new one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++generation.current;

      setState((prev) => ({ ...prev, running: true }));

      const result = await runForPreview({ code, language, entryFunction, argsJson }, controller.signal);

      // Ignore anything that isn't the newest run.
      if (result === null || runId !== generation.current) return;

      setState((prev) => {
        // A failed run means the code is mid-edit; keep showing the last good
        // visualization rather than clearing the panel.
        if (result.error || result.steps.length === 0) {
          return { result: prev.result, running: false, staleReason: result.error ?? null };
        }
        return { result, running: false, staleReason: null };
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [code, language, entryFunction, argsJson, enabled]);

  // Drop any pending run when the consumer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  return state;
}
