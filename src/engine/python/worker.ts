// Web Worker that runs user Python off the main thread using Pyodide
// (CPython compiled to WebAssembly). Pyodide is loaded lazily from a CDN on the
// first run so the initial app load stays light. Messages in and out:
//   in:  { id, code, entryFunction, argsJson, maxSteps }
//   out: { id, kind: 'status' | 'result' | 'error', ... }

/* eslint-disable @typescript-eslint/no-explicit-any */
import { TRACER_SOURCE } from './tracer';

const PYODIDE_VERSION = 'v0.26.4';
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<any> | null = null;

interface RunMessage {
  id: number;
  code: string;
  entryFunction: string;
  argsJson: string;
  maxSteps: number;
}

function post(msg: Record<string, unknown>) {
  (self as unknown as Worker).postMessage(msg);
}

async function getPyodide(id: number): Promise<any> {
  if (!pyodidePromise) {
    post({ id, kind: 'status', message: 'Downloading Python runtime (first run only)…' });
    pyodidePromise = (async () => {
      const mod = await import(/* @vite-ignore */ `${PYODIDE_INDEX}pyodide.mjs`);
      const pyodide = await mod.loadPyodide({ indexURL: PYODIDE_INDEX });
      pyodide.runPython(TRACER_SOURCE);
      return pyodide;
    })();
  }
  return pyodidePromise;
}

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const { id, code, entryFunction, argsJson, maxSteps } = event.data;
  try {
    const pyodide = await getPyodide(id);
    post({ id, kind: 'status', message: 'Running…' });
    const runFn = pyodide.globals.get('_run');
    const resultJson: string = runFn(code, entryFunction, argsJson, maxSteps);
    runFn.destroy?.();
    post({ id, kind: 'result', resultJson });
  } catch (err: any) {
    post({ id, kind: 'error', message: err?.message ?? String(err) });
  }
};
