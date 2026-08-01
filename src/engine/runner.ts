// Language-agnostic entry point for executing code. JavaScript runs on the main
// thread via the built-in interpreter; Python runs in a Web Worker via Pyodide.
// Both resolve to the same RunResult shape.

import type { RunRequest, RunResult } from './types';

const MAX_STEPS = 20000;
const PY_MAX_STEPS = 6000;
/** Live previews re-run on every typing pause, so they get a tighter budget. */
const LIVE_MAX_STEPS = 4000;

let worker: Worker | null = null;
let messageId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./python/worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export interface RunOptions {
  /** Collect per-line snapshots. Disable when only the return value matters. */
  trace?: boolean;
  maxSteps?: number;
  onStatus?: (message: string) => void;
  /**
   * Aborts the run. In-flight work isn't killed (the interpreter is synchronous
   * and a Pyodide call can't be interrupted mid-execution), but an aborted run
   * resolves to null so a stale result can never overwrite a newer one.
   */
  signal?: AbortSignal;
}

function runPython(request: RunRequest, options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const w = getWorker();
    const id = ++messageId;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.id !== id) return;

      if (data.kind === 'status') {
        options.onStatus?.(data.message);
        return;
      }
      w.removeEventListener('message', handleMessage);
      if (data.kind === 'error') {
        resolve({ steps: [], stdout: '', error: data.message });
        return;
      }
      try {
        resolve(JSON.parse(data.resultJson) as RunResult);
      } catch (err) {
        resolve({ steps: [], stdout: '', error: `Failed to read Python result: ${String(err)}` });
      }
    };

    w.addEventListener('message', handleMessage);
    w.postMessage({
      id,
      code: request.code,
      entryFunction: request.entryFunction,
      argsJson: request.argsJson,
      maxSteps: options.maxSteps ?? PY_MAX_STEPS,
      trace: options.trace ?? true,
    });
  });
}

/**
 * Runs `request`. Resolves to null when the run was aborted via `signal` —
 * callers should treat null as "superseded" and leave existing state alone.
 */
export async function run(request: RunRequest, options: RunOptions = {}): Promise<RunResult | null> {
  const { signal } = options;
  if (signal?.aborted) return null;

  let result: RunResult;
  if (request.language === 'python') {
    result = await runPython(request, options);
  } else {
    // Lazy-load the interpreter (and acorn) only on first use; this also yields
    // so the UI can paint a "running" state before a long synchronous run.
    const { runJavaScript } = await import('./jsInterpreter');
    result = runJavaScript(request, {
      maxSteps: options.maxSteps ?? MAX_STEPS,
      collectSteps: options.trace ?? true,
    });
  }

  return signal?.aborted ? null : result;
}

/** Convenience wrapper for judging: no tracing, just the return value. */
export function runForResult(request: RunRequest, signal?: AbortSignal): Promise<RunResult | null> {
  return run(request, { trace: false, signal });
}

/** Convenience wrapper for the live preview: traced, but on a tight budget. */
export function runForPreview(request: RunRequest, signal?: AbortSignal): Promise<RunResult | null> {
  return run(request, { trace: true, maxSteps: LIVE_MAX_STEPS, signal });
}

/** Frees the Python worker (used on teardown; harmless if never started). */
export function disposeRunner(): void {
  worker?.terminate();
  worker = null;
}
