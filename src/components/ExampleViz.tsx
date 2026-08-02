import { useMemo } from 'react';
import type { Language, Step, VizValue } from '../engine/types';
import type { Problem } from '../problems/types';
import { Visualizer } from './Visualizer';

/** Converts raw JSON example data into the shared value model. */
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
 * Reads parameter names from the reference solution so the example renders with
 * the same labels the problem statement uses (`nums`, `target`) rather than
 * positional placeholders.
 */
function parameterNames(problem: Problem, language: Language): string[] {
  const source = problem.referenceSolution[language];
  const entry = problem.entryFunction[language];
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
  problem: Problem;
  language: Language;
  exampleIndex: number;
}

/**
 * Draws a problem's example input with the same renderers used for execution
 * steps, so the shape of the data is visible before any code is written.
 */
export function ExampleViz({ problem, language, exampleIndex }: Props) {
  const step = useMemo<Step>(() => {
    const example = problem.examples[exampleIndex] ?? problem.examples[0];
    const names = parameterNames(problem, language);
    const variables: Record<string, VizValue> = {};
    example.args.forEach((arg, i) => {
      variables[names[i] ?? `arg${i + 1}`] = toVizValue(arg);
    });
    return { line: 0, variables, callStack: [], stdout: '' };
  }, [problem, language, exampleIndex]);

  return (
    <div className="example-viz">
      <div className="example-viz-label">Example input</div>
      <Visualizer step={step} prevStep={null} />
      <div className="example-viz-expected">
        Expected output: <code>{(problem.examples[exampleIndex] ?? problem.examples[0]).outputLabel}</code>
      </div>
    </div>
  );
}
