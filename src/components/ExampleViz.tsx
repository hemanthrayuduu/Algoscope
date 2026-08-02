import { useMemo } from 'react';
import type { Language, Step, VizValue } from '../engine/types';
import type { LibraryItem } from '../library/types';
import { Visualizer } from './Visualizer';

/** Converts raw JSON argument data into the shared value model. */
function toVizValue(value: unknown): VizValue {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(toVizValue);
  if (typeof value === 'object') {
    const fields: Record<string, VizValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields[k] = toVizValue(v);
    return { __kind: 'object', fields };
  }
  return value as VizValue;
}

/**
 * Reads parameter names from the item's code so the preview renders with the
 * same labels the statement uses (`nums`, `target`) rather than positional
 * placeholders.
 */
function parameterNames(item: LibraryItem, language: Language): string[] {
  const variant = item.languages[language];
  if (!variant) return [];
  const source = variant.referenceSolution ?? variant.code;
  const entry = variant.entryFunction;
  const pattern =
    language === 'python'
      ? new RegExp(`def\\s+${entry}\\s*\\(([^)]*)\\)`)
      : new RegExp(`function\\s+${entry}\\s*\\(([^)]*)\\)`);
  const match = source.match(pattern);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((p) => p.trim().split('=')[0].trim())
    .filter(Boolean);
}

interface Props {
  item: LibraryItem;
  language: Language;
  argsJson: string;
}

/**
 * Draws the input the code is about to run on, using the same renderers as an
 * execution step. Shown before anything has been run, so the shape of the data
 * is visible from the moment an item is opened.
 */
export function ExampleViz({ item, language, argsJson }: Props) {
  const step = useMemo<Step | null>(() => {
    let args: unknown[];
    try {
      const parsed = JSON.parse(argsJson || '[]');
      args = Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
    const names = parameterNames(item, language);
    const variables: Record<string, VizValue> = {};
    args.forEach((arg, i) => {
      variables[names[i] ?? `arg${i + 1}`] = toVizValue(arg);
    });
    return { line: 0, variables, callStack: [], stdout: '' };
  }, [item, language, argsJson]);

  const expected = item.examples?.[0]?.outputLabel;

  return (
    <div className="example-viz">
      <div className="example-viz-label">Input · run your code to watch it change</div>
      {step ? <Visualizer step={step} prevStep={null} /> : <div className="viz-empty">Arguments aren't valid JSON.</div>}
      {expected && (
        <div className="example-viz-expected">
          Expected output: <code>{expected}</code>
        </div>
      )}
    </div>
  );
}
