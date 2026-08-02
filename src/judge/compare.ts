// Result comparison for the judge.
//
// Correctness has to survive two sources of harmless variation:
//   1. Problems with several valid answers (index pairs in either order, groups
//      in any order). Strict deep equality would reject correct solutions.
//   2. Cross-language representation. The engines return values in the shared
//      VizValue model, where a Python dict and a JS Map both become
//      `{ __kind: 'map', entries }`, so comparison happens after unwrapping
//      those tags into plain JS values.

import type { CompareMode } from '../library/types';

/**
 * Unwraps the tagged VizValue model into plain JS values so that results
 * produced by different language backends can be compared directly.
 */
export function toPlain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(toPlain);

  const tagged = value as Record<string, any>;
  switch (tagged.__kind) {
    case 'map': {
      // Compare maps/dicts as sorted key/value pairs: insertion order is an
      // implementation detail, not part of the answer.
      const entries = (tagged.entries as [unknown, unknown][]).map(([k, v]) => [toPlain(k), toPlain(v)]);
      entries.sort((a, b) => canonical(a[0]).localeCompare(canonical(b[0])));
      return { __map: entries };
    }
    case 'set': {
      const items = (tagged.items as unknown[]).map(toPlain);
      items.sort((a, b) => canonical(a).localeCompare(canonical(b)));
      return { __set: items };
    }
    case 'function':
      return { __function: tagged.name };
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(tagged.fields ?? {})) out[k] = toPlain(v);
      return out;
    }
    default: {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(tagged)) out[k] = toPlain(v);
      return out;
    }
  }
}

/** Stable string form of a value, used for order-insensitive comparisons. */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}:${canonical(v)}`)
      .sort();
    return `{${entries.join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Treat null and undefined as equivalent: Python's None round-trips as null,
  // while a JS function with no explicit return yields undefined.
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    // Tolerate floating point drift between the two runtimes.
    if (!Number.isInteger(a) || !Number.isInteger(b)) return Math.abs(a - b) < 1e-9;
    return a === b;
  }

  // Python bools serialize as true/false, but a solution returning 1/0 for a
  // boolean answer is not what was asked for, so no cross-type coercion here.
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object') {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (aKeys.length !== bKeys.length || !aKeys.every((k, i) => k === bKeys[i])) return false;
    return aKeys.every((k) => deepEqual((a as any)[k], (b as any)[k]));
  }

  return false;
}

/** Sorts arrays canonically (recursively) so ordering stops mattering. */
function sortDeep(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const items = value.map(sortDeep);
  items.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return items;
}

function dedupe(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of value.map(sortDeep)) {
    const key = canonical(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  out.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return out;
}

/**
 * Compares an actual result with the expected one under the problem's rules.
 * Both sides are unwrapped from the VizValue model first.
 */
export function resultsMatch(actual: unknown, expected: unknown, mode: CompareMode): boolean {
  const a = toPlain(actual);
  const b = toPlain(expected);

  switch (mode) {
    case 'exact':
      return deepEqual(a, b);
    case 'unordered':
      return deepEqual(sortDeep(a), sortDeep(b));
    case 'set':
      return deepEqual(dedupe(a), dedupe(b));
    default:
      return deepEqual(a, b);
  }
}

/** Compact, readable rendering of a value for the results panel. */
export function formatValue(value: unknown): string {
  const plain = toPlain(value);
  const render = (v: unknown): string => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(render).join(', ')}]`;
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (obj.__map) return `{${(obj.__map as [unknown, unknown][]).map(([k, val]) => `${render(k)}: ${render(val)}`).join(', ')}}`;
      if (obj.__set) return `{${(obj.__set as unknown[]).map(render).join(', ')}}`;
      if (obj.__function) return `ƒ ${obj.__function}`;
      return `{${Object.entries(obj).map(([k, val]) => `${k}: ${render(val)}`).join(', ')}}`;
    }
    return String(v);
  };
  return render(plain);
}
