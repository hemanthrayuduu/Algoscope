// Validates the library itself.
//
// The judge derives expected outputs from each challenge's reference solution,
// so a wrong reference would silently mark correct submissions as failures.
// These tests make that impossible to ship: every reference must pass its own
// test cases, every demo must actually run, and no item may be duplicated
// across kinds.
//
// Only the JavaScript side runs here — Python needs Pyodide, which isn't
// available in this environment. `scripts/check-python-references.mjs` covers
// the Python code against real CPython.

import { describe, expect, it } from 'vitest';
import { CHALLENGES, DEMOS, LIBRARY, SCRATCH, getItem, groupedFor, neighbours, searchLibrary } from './index';
import { isJudgeable } from './types';
import { judge } from '../judge/judge';
import { resultsMatch } from '../judge/compare';
import { runJavaScript } from '../engine/jsInterpreter';

describe('library structure', () => {
  it('has a unique id for every item', () => {
    const ids = LIBRARY.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The whole point of merging examples and problems was to stop shipping the
  // same algorithm twice under two different names.
  it('does not offer the same algorithm as both a challenge and a demo', () => {
    const challengeTitles = new Set(CHALLENGES.map((c) => normalizeTitle(c.title)));
    const clashes = DEMOS.filter((d) => challengeTitles.has(normalizeTitle(d.title))).map((d) => d.title);
    expect(clashes).toEqual([]);
  });

  it('marks exactly the items with test cases as judgeable', () => {
    for (const item of CHALLENGES) expect(isJudgeable(item)).toBe(true);
    for (const item of DEMOS) expect(isJudgeable(item)).toBe(false);
    expect(isJudgeable(SCRATCH)).toBe(false);
  });

  it('groups every item into the picker for both languages', () => {
    for (const language of ['javascript', 'python'] as const) {
      const grouped = groupedFor(language).flatMap((g) => g.items);
      const supported = LIBRARY.filter((i) => i.languages[language]);
      expect(grouped).toHaveLength(supported.length);
    }
  });

  it('falls back to a real item for an unknown id', () => {
    expect(getItem('does-not-exist').id).toBeTruthy();
  });

  for (const item of LIBRARY) {
    describe(item.title, () => {
      it('is written in both languages with valid preview arguments', () => {
        expect(item.description.length).toBeGreaterThan(20);
        expect(Object.keys(item.languages).length).toBeGreaterThan(0);
        for (const [language, variant] of Object.entries(item.languages)) {
          expect(variant.code, `${language} code`).toBeTruthy();
          if (item.kind === 'scratch') {
            // A scratchpad is a plain script: no function to call, so a blank
            // entry is the correct value rather than a missing one.
            expect(variant.entryFunction, `${language} entry`).toBe('');
          } else {
            expect(variant.entryFunction, `${language} entry`).toBeTruthy();
            // A user who submits without renaming anything should get a real
            // result, not "function not found".
            expect(variant.code).toContain(variant.entryFunction);
          }
        }
        const args = JSON.parse(item.previewArgs);
        expect(Array.isArray(args)).toBe(true);
      });
    });
  }
});

describe('challenges', () => {
  for (const item of CHALLENGES) {
    describe(item.title, () => {
      it('has a statement, constraints, examples and enough test cases', () => {
        expect(item.constraints?.length).toBeGreaterThan(0);
        expect(item.examples?.length).toBeGreaterThan(0);
        expect(item.testCases!.length).toBeGreaterThanOrEqual(3);
        expect(item.difficulty).toBeTruthy();
        for (const variant of Object.values(item.languages)) {
          expect(variant.referenceSolution).toBeTruthy();
        }
        const arity = item.testCases![0].args.length;
        for (const example of item.examples!) expect(example.args.length).toBe(arity);
      });

      it('the JavaScript reference solution passes every test case', async () => {
        const report = await judge(item, item.languages.javascript!.referenceSolution!, 'javascript');
        expect(report).not.toBeNull();
        expect(report!.fatalError).toBeUndefined();
        const failures = report!.results.filter((r) => !r.passed);
        expect(failures.map((f) => `case ${f.index}: ${f.input ?? '(hidden)'} -> ${f.actual ?? f.error}`)).toEqual([]);
        expect(report!.allPassed).toBe(true);
      });

      it('can supply whatever it opens with', () => {
        // An item that opens with its solution must actually have one in every
        // language it declares, or it would open with an empty stub instead.
        if (item.openWith === 'solution') {
          for (const [language, variant] of Object.entries(item.languages)) {
            expect(variant.referenceSolution, `${language} reference`).toBeTruthy();
          }
        }
      });

      it('rejects the unmodified starter code', async () => {
        // If a stub passes, the comparison mode is too lenient for this item.
        const report = await judge(item, item.languages.javascript!.code, 'javascript');
        expect(report).not.toBeNull();
        expect(report!.allPassed).toBe(false);
      });
    });
  }
});

describe('demos', () => {
  for (const item of DEMOS) {
    it(`${item.title} runs cleanly in JavaScript on its preview arguments`, () => {
      const variant = item.languages.javascript!;
      const result = runJavaScript(
        {
          code: variant.code,
          language: 'javascript',
          entryFunction: variant.entryFunction,
          argsJson: item.previewArgs,
        },
        { collectSteps: false },
      );
      expect(result.error).toBeUndefined();
      expect(result.returnValue).toBeDefined();
    });

    it(`${item.title} produces steps to visualize`, () => {
      const variant = item.languages.javascript!;
      const result = runJavaScript({
        code: variant.code,
        language: 'javascript',
        entryFunction: variant.entryFunction,
        argsJson: item.previewArgs,
      });
      // A demo that produces no steps has nothing to show, which defeats the
      // point of it being in the library.
      expect(result.steps.length).toBeGreaterThan(0);
    });
  }
});

describe('scratchpad', () => {
  it('runs out of the box in JavaScript as a script', () => {
    const variant = SCRATCH.languages.javascript!;
    const result = runJavaScript({
      code: variant.code,
      language: 'javascript',
      entryFunction: variant.entryFunction,
      argsJson: SCRATCH.previewArgs,
    });
    expect(result.error).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('produces variables worth visualizing', () => {
    // The scratchpad is the front door for bringing your own code, so what it
    // ships with has to demonstrate the point: an array, a map, some scalars.
    const variant = SCRATCH.languages.javascript!;
    const result = runJavaScript({
      code: variant.code,
      language: 'javascript',
      entryFunction: variant.entryFunction,
      argsJson: '[]',
    });
    const last = result.steps[result.steps.length - 1];
    expect(Array.isArray(last.variables.array)).toBe(true);
    expect((last.variables.seen as any).__kind).toBe('map');
    expect(typeof last.variables.total).toBe('number');
  });
});

describe('judge behaviour', () => {
  const twoSum = CHALLENGES.find((c) => c.id === 'two-sum')!;

  it('reports a wrong solution as failing, with detail', async () => {
    const report = await judge(twoSum, 'function twoSum(nums, target) { return [0, 0]; }', 'javascript');
    expect(report!.allPassed).toBe(false);
    const failure = report!.results.find((r) => !r.passed && !r.hidden)!;
    expect(failure.expected).toBeTruthy();
    expect(failure.actual).toBe('[0, 0]');
  });

  it('surfaces a runtime error on the offending case', async () => {
    const report = await judge(twoSum, 'function twoSum(nums, target) { return nums.missingMethod(); }', 'javascript');
    expect(report!.allPassed).toBe(false);
    expect(report!.results[0].error).toBeTruthy();
  });

  it('hides inputs for hidden cases', async () => {
    const report = await judge(twoSum, twoSum.languages.javascript!.referenceSolution!, 'javascript');
    const hidden = report!.results.filter((r) => r.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const result of hidden) {
      expect(result.input).toBeUndefined();
      expect(result.expected).toBeUndefined();
    }
  });

  it('accepts a correct solution that returns indices in the other order', async () => {
    const reversed = `function twoSum(nums, target) {
      for (let i = nums.length - 1; i >= 0; i--) {
        for (let j = 0; j < i; j++) {
          if (nums[i] + nums[j] === target) return [i, j];
        }
      }
      return [];
    }`;
    const report = await judge(twoSum, reversed, 'javascript');
    expect(report!.allPassed).toBe(true);
  });

  it('refuses to judge an item without test cases', async () => {
    const report = await judge(DEMOS[0], DEMOS[0].languages.javascript!.code, 'javascript');
    expect(report!.fatalError).toMatch(/no test cases/i);
  });

  it('normalizes linked lists so node chains compare by value', () => {
    const reverseList = CHALLENGES.find((c) => c.id === 'reverse-linked-list')!;
    const chain = { __kind: 'object', fields: { val: 1, next: { __kind: 'object', fields: { val: 2, next: null } } } };
    const flattened = reverseList.normalize!(chain);
    expect(flattened).toEqual([1, 2]);
    expect(resultsMatch(flattened, [1, 2], 'exact')).toBe(true);
  });
});

describe('search', () => {
  it('returns everything for an empty query', () => {
    expect(searchLibrary('', 'javascript')).toHaveLength(LIBRARY.length);
    expect(searchLibrary('   ', 'javascript')).toHaveLength(LIBRARY.length);
  });

  it('matches on title', () => {
    const results = searchLibrary('two sum', 'javascript');
    expect(results.map((r) => r.id)).toContain('two-sum');
  });

  it('matches on topic', () => {
    const results = searchLibrary('tree', 'javascript').map((r) => r.id);
    expect(results).toContain('max-depth-binary-tree');
    expect(results).toContain('build-bst');
  });

  it('matches on difficulty', () => {
    const results = searchLibrary('medium', 'javascript');
    expect(results.every((r) => r.difficulty === 'Medium' || r.description.toLowerCase().includes('medium'))).toBe(true);
    expect(results.map((r) => r.id)).toContain('merge-intervals');
  });

  it('narrows when several terms are given', () => {
    const broad = searchLibrary('sorting', 'javascript');
    const narrow = searchLibrary('sorting recursion', 'javascript');
    expect(narrow.length).toBeLessThan(broad.length);
    expect(narrow.map((r) => r.id)).toContain('quicksort');
  });

  it('is case-insensitive and returns nothing for nonsense', () => {
    expect(searchLibrary('BINARY', 'javascript').length).toBeGreaterThan(0);
    expect(searchLibrary('zzzznotathing', 'javascript')).toHaveLength(0);
  });

  it('only returns items available in the requested language', () => {
    for (const language of ['javascript', 'python'] as const) {
      for (const item of searchLibrary('', language)) {
        expect(item.languages[language]).toBeTruthy();
      }
    }
  });
});

describe('neighbours', () => {
  it('has no previous item at the start and no next at the end', () => {
    const available = LIBRARY.filter((i) => i.languages.javascript);
    expect(neighbours(available[0].id, 'javascript').prev).toBeNull();
    expect(neighbours(available[available.length - 1].id, 'javascript').next).toBeNull();
  });

  it('steps forward and back through the library in order', () => {
    const available = LIBRARY.filter((i) => i.languages.javascript);
    const second = available[1];
    const { prev, next } = neighbours(second.id, 'javascript');
    expect(prev?.id).toBe(available[0].id);
    expect(next?.id).toBe(available[2].id);
  });

  it('returns nothing for an unknown id', () => {
    expect(neighbours('nope', 'javascript')).toEqual({ prev: null, next: null });
  });
});

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z]/g, '');
}
