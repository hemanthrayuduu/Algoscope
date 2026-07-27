// Language-agnostic entry point for executing code. JavaScript runs on the
// main thread via the built-in interpreter; Python runs in a Web Worker via
// Pyodide. Both resolve to the same RunResult shape.

import type { RunRequest, RunResult } from './types';

const MAX_STEPS = 20000;
const PY_MAX_STEPS = 6000;

let worker: Worker | null = null;
let messageId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./python/worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

/** Runs Python in the worker, forwarding progress messages to `onStatus`. */
function runPython(request: RunRequest, onStatus?: (message: string) => void): Promise<RunResult> {
  return new Promise((resolve) => {
    const w = getWorker();
    const id = ++messageId;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.id !== id) return;

      if (data.kind === 'status') {
        onStatus?.(data.message);
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
      maxSteps: PY_MAX_STEPS,
    });
  });
}

export async function run(request: RunRequest, onStatus?: (message: string) => void): Promise<RunResult> {
  if (request.language === 'python') return runPython(request, onStatus);
  // Lazy-load the interpreter (and acorn) only on the first JS run; this also
  // yields so the UI can paint a "running" state before a big run.
  const { runJavaScript } = await import('./jsInterpreter');
  return runJavaScript(request, MAX_STEPS);
}

/** Frees the Python worker (used on teardown; harmless if never started). */
export function disposeRunner(): void {
  worker?.terminate();
  worker = null;
}
