// Decides how each variable in a snapshot should be drawn.

import type { VizObject, VizValue } from '../../engine/types';
import { isTagged } from '../../engine/types';

export type ValueKind =
  | 'primitive'
  | 'string'
  | 'array1d'
  | 'array2d'
  | 'linkedList'
  | 'tree'
  | 'graph'
  | 'map'
  | 'set'
  | 'object'
  | 'function';

const VALUE_FIELDS = ['val', 'value', 'data', 'key'];
const CHILD_FIELDS = ['next', 'left', 'right', 'children', 'prev'];

export function isPrimitive(v: VizValue): v is number | string | boolean | null {
  return v === null || ['number', 'string', 'boolean'].includes(typeof v);
}

export function isArray(v: VizValue): v is VizValue[] {
  return Array.isArray(v);
}

export function isNodeLike(v: VizValue): v is VizObject {
  if (!isTagged(v) || v.__kind !== 'object') return false;
  const keys = Object.keys(v.fields);
  return keys.some((k) => VALUE_FIELDS.includes(k)) && keys.some((k) => CHILD_FIELDS.includes(k));
}

function nodeChildFields(v: VizObject): string[] {
  return Object.keys(v.fields).filter((k) => CHILD_FIELDS.includes(k));
}

/**
 * Strings long enough to be worth drawing per character. A one-character
 * string is clearer in the scalar table than as a lone cell.
 */
export function isDrawableString(v: VizValue): v is string {
  return typeof v === 'string' && v.length > 1 && v.length <= 60;
}

export function classify(v: VizValue): ValueKind {
  if (isDrawableString(v)) return 'string';
  if (isPrimitive(v)) return 'primitive';
  if (isArray(v)) {
    if (v.length > 0 && v.every((x) => isArray(x))) return 'array2d';
    return 'array1d';
  }
  if (isTagged(v)) {
    if (v.__kind === 'map') return 'map';
    if (v.__kind === 'set') return 'set';
    if (v.__kind === 'function') return 'function';
    if (v.__kind === 'object') {
      if (isNodeLike(v)) {
        const childFields = nodeChildFields(v);
        const treeish = childFields.includes('left') || childFields.includes('right') || childFields.includes('children');
        return treeish ? 'tree' : 'linkedList';
      }
      return 'object';
    }
  }
  return 'object';
}

/** True for values worth drawing as a big visual (vs. the scalar side panel). */
export function isStructural(kind: ValueKind): boolean {
  return kind !== 'primitive' && kind !== 'function';
}

export { isDrawableString as isStringCells };

export { VALUE_FIELDS, CHILD_FIELDS };
