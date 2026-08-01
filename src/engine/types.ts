// Shared execution model used by every language backend and every renderer.
//
// The whole app is built around one idea: running code produces an ordered
// list of `Step`s, and each step is a fully serializable snapshot of program
// state at one line. The JS interpreter and the Python (Pyodide) tracer both
// emit this exact shape, so a single set of D3 renderers can visualize both.

/**
 * A serializable value in a snapshot. Both language backends normalize their
 * native values into this format so the renderers never need language-specific
 * logic. Primitives are represented directly; everything else is a tagged
 * object. Plain untagged objects represent record/instance-like values
 * (e.g. a linked-list node `{ val, next }` or a tree node `{ val, left, right }`),
 * which lets the renderer detect and draw them as node-link diagrams.
 */
export type VizValue =
  | number
  | string
  | boolean
  | null
  | VizValue[]
  | VizMap
  | VizSet
  | VizObject
  | VizFunction;

export interface VizMap {
  __kind: 'map';
  entries: [VizValue, VizValue][];
}

export interface VizSet {
  __kind: 'set';
  items: VizValue[];
}

/** A record/instance: plain named fields. `className` is set for class instances. */
export interface VizObject {
  __kind: 'object';
  className?: string;
  fields: Record<string, VizValue>;
}

export interface VizFunction {
  __kind: 'function';
  name: string;
}

export interface CallFrame {
  fn: string;
  line: number;
}

/** One observable moment of execution. */
export interface Step {
  /** 1-based line number in the user's source that is about to run / just ran. */
  line: number;
  /** All variables visible at this point, innermost scope winning. */
  variables: Record<string, VizValue>;
  /** Function-call stack, outermost first. */
  callStack: CallFrame[];
  /** Cumulative stdout captured up to and including this step. */
  stdout: string;
  /** Optional short human-readable note about what happened. */
  note?: string;
}

export interface RunResult {
  steps: Step[];
  returnValue?: VizValue;
  stdout: string;
  /** Set when execution stopped early because of an error. Steps up to the
   *  failure are still returned so the user can see how far it got. */
  error?: string;
}

export type Language = 'javascript' | 'python';

export interface RunRequest {
  code: string;
  language: Language;
  /** Name of the function to invoke after defining the code. */
  entryFunction: string;
  /** JSON array string of positional arguments for the entry function. */
  argsJson: string;
}

/** Guard: is this a tagged object value (map/set/object/function)? */
export function isTagged(
  v: VizValue,
): v is VizMap | VizSet | VizObject | VizFunction {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && '__kind' in v;
}
