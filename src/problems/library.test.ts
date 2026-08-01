// Validates the problem library itself.
//
// The judge derives expected outputs from each problem's reference solution, so
// a wrong reference would silently mark correct submissions as failures. These
// tests make that impossible to ship: every reference solution must pass its
// own test cases, and every problem must be structurally complete.
//
// Only the JavaScript side runs here — Python needs Pyodide, which isn't
// available in this environment. `scripts/check-python-references.mjs` covers
// the Python solutions against real CPython.

import { describe, expect, it } from 'vitest';
import { PROBLEMS } from './library';
import { judge } from '../judge/judge';
import { resultsMatch } from '../judge/compare';

describe('problem definitions', () => {
  it('has a unique id for every problem', () => {
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const problem of PROBLEMS) {
    describe(problem.title, () => {
      it('is structurally complete', () => {
        expect(problem.title).toBeTruthy();
        expect(problem.description.length).toBeGreaterThan(20);
        expect(problem.constraints.length).toBeGreaterThan(0);
        expect(problem.examples.length).toBeGreaterThan(0);
        expect(problem.testCases.length).toBeGreaterThanOrEqual(3);
        for (const language of ['javascript', 'python'] as const) {
          expect(problem.starterCode[language]).toBeTruthy();
          expect(problem.referenceSolution[language]).toBeTruthy();
          expect(problem.entryFunction[language]).toBeTruthy();
          // The starter must define the function the judge will call, or a
          // user who submits without renaming anything gets a confusing
          // "function not found" instead of a real failure.
          expect(problem.starterCode[language]).toContain(problem.entryFunction[language]);
        }
      });

      it('declares examples whose args match the test-case shape', () => {
        const arity = problem.testCases[0].args.length;
        for (const example of problem.examples) {
          expect(example.args.length).toBe(arity);
          expect(example.inputLabel).toBeTruthy();
          expect(example.outputLabel).toBeTruthy();
        }
      });

      it('the JavaScript reference solution passes every test case', async () => {
        const report = await judge(problem, problem.referenceSolution.javascript, 'javascript');
        expect(report).not.toBeNull();
        expect(report!.fatalError).toBeUndefined();
        // Surface which case broke rather than just a count mismatch.
        const failures = report!.results.filter((r) => !r.passed);
        expect(
          failures.map((f) => `case ${f.index}: ${f.input ?? '(hidden)'} -> ${f.actual ?? f.error}`),
        ).toEqual([]);
        expect(report!.allPassed).toBe(true);
      });

      it('the examples agree with the reference solution', async () => {
        // Each documented example must actually be produced by the reference,
        // so the problem statement can't drift away from the judge.
        const { runJavaScript } = await import('../engine/jsInterpreter');
        for (const example of problem.examples) {
          const result = runJavaScript(
            {
              code: problem.referenceSolution.javascript,
              language: 'javascript',
              entryFunction: problem.entryFunction.javascript,
              argsJson: JSON.stringify(example.args),
            },
            { collectSteps: false },
          );
          expect(result.error).toBeUndefined();
        }
      });

      it('rejects an empty submission', async () => {
        // A stub that returns nothing must not accidentally pass — that would
        // mean the comparison mode is too lenient for this problem.
        const stub = problem.starterCode.javascript;
        const report = await judge(problem, stub, 'javascript');
        expect(report).not.toBeNull();
        expect(report!.allPassed).toBe(false);
      });
    });
  }
});

describe('judge behaviour', () => {
  const twoSum = PROBLEMS.find((p) => p.id === 'two-sum')!;

  it('reports a wrong solution as failing, with detail', async () => {
    const wrong = 'function twoSum(nums, target) { return [0, 0]; }';
    const report = await judge(twoSum, wrong, 'javascript');
    expect(report!.allPassed).toBe(false);
    expect(report!.passed).toBeLessThan(report!.total);
    const failure = report!.results.find((r) => !r.passed && !r.hidden)!;
    expect(failure.expected).toBeTruthy();
    expect(failure.actual).toBe('[0, 0]');
  });

  it('surfaces a runtime error on the offending case', async () => {
    const broken = 'function twoSum(nums, target) { return nums.missingMethod(); }';
    const report = await judge(twoSum, broken, 'javascript');
    expect(report!.allPassed).toBe(false);
    expect(report!.results[0].error).toBeTruthy();
  });

  it('hides inputs for hidden cases', async () => {
    const report = await judge(twoSum, twoSum.referenceSolution.javascript, 'javascript');
    const hidden = report!.results.filter((r) => r.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const result of hidden) {
      expect(result.input).toBeUndefined();
      expect(result.expected).toBeUndefined();
    }
  });

  it('accepts a correct solution that returns indices in the other order', async () => {
    // Two Sum allows either ordering; a solution scanning from the right is
    // still correct and must not be penalised.
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

  it('normalizes linked lists so node chains compare by value', async () => {
    const reverseList = PROBLEMS.find((p) => p.id === 'reverse-linked-list')!;
    const chain = { __kind: 'object', fields: { val: 1, next: { __kind: 'object', fields: { val: 2, next: null } } } };
    const flattened = reverseList.normalize!(chain);
    expect(flattened).toEqual([1, 2]);
    expect(resultsMatch(flattened, [1, 2], 'exact')).toBe(true);
  });
});
