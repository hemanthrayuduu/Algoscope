import type { RunResult, Step, VizValue } from '../engine/types';
import { isTagged } from '../engine/types';

function formatValue(v: VizValue | undefined): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (isTagged(v)) {
    if (v.__kind === 'function') return `ƒ ${v.name}`;
    if (v.__kind === 'map') return `Map(${v.entries.length})`;
    if (v.__kind === 'set') return `Set(${v.items.length})`;
    if (v.__kind === 'object') return v.className ? `${v.className} {…}` : '{…}';
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

interface Props {
  result: RunResult | null;
  step: Step | null;
  status: string;
}

export function OutputPanel({ result, step, status }: Props) {
  const stdout = step ? step.stdout : result?.stdout ?? '';

  return (
    <div className="output-panel">
      <div className="output-section">
        <div className="output-label">Console</div>
        <pre className="output-console">{stdout || '—'}</pre>
      </div>
      {step?.note && (
        <div className="output-section">
          <div className="output-label">Step</div>
          <div className="output-note">{step.note}</div>
        </div>
      )}
      {result && !result.error && (
        <div className="output-section">
          <div className="output-label">Return value</div>
          <pre className="output-return">{formatValue(result.returnValue)}</pre>
        </div>
      )}
      {result?.error && (
        <div className="output-section">
          <div className="output-label output-label-error">Error</div>
          <pre className="output-error">{result.error}</pre>
        </div>
      )}
      {status && !result && <div className="output-status">{status}</div>}
    </div>
  );
}
