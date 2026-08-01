import { describe, expect, it } from 'vitest';
import { formatValue, resultsMatch, toPlain } from './compare';

describe('toPlain', () => {
  it('unwraps maps, sets and objects from the shared value model', () => {
    expect(toPlain({ __kind: 'map', entries: [['a', 1]] })).toEqual({ __map: [['a', 1]] });
    expect(toPlain({ __kind: 'set', items: [2, 1] })).toEqual({ __set: [1, 2] });
    expect(toPlain({ __kind: 'object', className: 'ListNode', fields: { val: 1, next: null } })).toEqual({
      val: 1,
      next: null,
    });
  });

  it('treats a JS Map and a Python dict identically', () => {
    const fromJs = { __kind: 'map', entries: [['b', 2], ['a', 1]] };
    const fromPython = { __kind: 'map', entries: [['a', 1], ['b', 2]] };
    expect(toPlain(fromJs)).toEqual(toPlain(fromPython));
  });
});

describe('exact comparison', () => {
  it('accepts identical values and rejects different ones', () => {
    expect(resultsMatch([1, 2, 3], [1, 2, 3], 'exact')).toBe(true);
    expect(resultsMatch([1, 2, 3], [1, 2, 4], 'exact')).toBe(false);
    expect(resultsMatch(5, 5, 'exact')).toBe(true);
    expect(resultsMatch('ab', 'ab', 'exact')).toBe(true);
  });

  it('is order-sensitive', () => {
    expect(resultsMatch([1, 2], [2, 1], 'exact')).toBe(false);
  });

  it('treats null and undefined as equivalent across languages', () => {
    // Python None and a JS function with no return both mean "no value".
    expect(resultsMatch(null, undefined, 'exact')).toBe(true);
  });

  it('does not conflate booleans with numbers', () => {
    expect(resultsMatch(true, 1, 'exact')).toBe(false);
    expect(resultsMatch(false, 0, 'exact')).toBe(false);
  });

  it('tolerates float drift but not integer differences', () => {
    expect(resultsMatch(0.1 + 0.2, 0.3, 'exact')).toBe(true);
    expect(resultsMatch(3, 4, 'exact')).toBe(false);
  });

  it('compares nested structures', () => {
    expect(resultsMatch([[1, 6], [8, 10]], [[1, 6], [8, 10]], 'exact')).toBe(true);
    expect(resultsMatch([[1, 6], [8, 10]], [[1, 6], [8, 11]], 'exact')).toBe(false);
  });
});

describe('unordered comparison', () => {
  it('accepts either ordering of an index pair', () => {
    expect(resultsMatch([0, 1], [1, 0], 'unordered')).toBe(true);
  });

  it('accepts groups returned in any order', () => {
    const actual = [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']];
    const expected = [['ate', 'eat', 'tea'], ['bat'], ['tan', 'nat']];
    expect(resultsMatch(actual, expected, 'unordered')).toBe(true);
  });

  it('still rejects genuinely wrong answers', () => {
    expect(resultsMatch([0, 2], [1, 0], 'unordered')).toBe(false);
    expect(resultsMatch([1, 2, 3], [1, 2], 'unordered')).toBe(false);
  });

  it('does not ignore duplicates', () => {
    expect(resultsMatch([1, 1, 2], [1, 2, 2], 'unordered')).toBe(false);
  });
});

describe('set comparison', () => {
  it('ignores order and duplicates', () => {
    expect(resultsMatch([3, 1, 1, 2], [1, 2, 3], 'set')).toBe(true);
  });

  it('rejects missing or extra elements', () => {
    expect(resultsMatch([1, 2], [1, 2, 3], 'set')).toBe(false);
  });
});

describe('formatValue', () => {
  it('renders values readably for the results panel', () => {
    expect(formatValue([1, 2, 3])).toBe('[1, 2, 3]');
    expect(formatValue('hi')).toBe('"hi"');
    expect(formatValue(null)).toBe('null');
    expect(formatValue({ __kind: 'map', entries: [['a', 1]] })).toBe('{"a": 1}');
    expect(formatValue({ __kind: 'object', fields: { val: 1, next: null } })).toBe('{val: 1, next: null}');
  });
});
