// Runs a submission against a challenge's test cases and reports pass/fail.
//
// Expected outputs are produced by running the challenge's own reference
// solution against the same inputs, so an author only has to supply inputs.
// That also means a broken reference surfaces immediately (the test suite
// asserts every reference passes its own cases) instead of silently marking
// correct submissions wrong.

import { runForResult } from '../engine/runner';
import type { Language } from '../engine/types';
import type { LibraryItem, TestCase } from '../library/types';
import { isJudgeable } from '../library/types';
import { formatValue, resultsMatch } from './compare';

export interface CaseResult {
  index: number;
  passed: boolean;
  hidden: boolean;
  /** Rendered input, omitted for hidden cases. */
  input?: string;
  expected?: string;
  actual?: string;
  stdout?: string;
  error?: string;
}

export interface JudgeReport {
  total: number;
  passed: number;
  allPassed: boolean;
  results: CaseResult[];
  /** Set when the run failed before any case could be judged. */
  fatalError?: string;
}

function renderArgs(args: unknown[]): string {
  return args.map((a) => JSON.stringify(a)).join(', ');
}

async function runCase(
  code: string,
  language: Language,
  entryFunction: string,
  testCase: TestCase,
  signal?: AbortSignal,
) {
  return runForResult({ code, language, entryFunction, argsJson: JSON.stringify(testCase.args) }, signal);
}

/**
 * Computes the expected output for each test case by running the reference
 * solution. Cases with an explicit `expected` skip the run.
 */
export async function computeExpected(
  item: LibraryItem,
  language: Language,
  signal?: AbortSignal,
): Promise<{ expected: unknown[]; error?: string }> {
  const variant = item.languages[language];
  if (!variant?.referenceSolution) {
    return { expected: [], error: `No reference solution for ${language}.` };
  }

  const expected: unknown[] = [];
  for (const testCase of item.testCases ?? []) {
    if ('expected' in testCase && testCase.expected !== undefined) {
      expected.push(testCase.expected);
      continue;
    }
    const result = await runCase(variant.referenceSolution, language, variant.entryFunction, testCase, signal);
    if (result === null) return { expected, error: 'aborted' };
    if (result.error) {
      return { expected, error: `Reference solution failed on ${renderArgs(testCase.args)}: ${result.error}` };
    }
    expected.push(result.returnValue);
  }
  return { expected };
}

/**
 * Judges `code` against every test case of `item`.
 *
 * Runs are sequential rather than parallel: the Python backend is a single
 * worker, so concurrent submissions would just queue behind each other anyway.
 */
export async function judge(
  item: LibraryItem,
  code: string,
  language: Language,
  signal?: AbortSignal,
): Promise<JudgeReport | null> {
  if (!isJudgeable(item)) {
    return { total: 0, passed: 0, allPassed: false, results: [], fatalError: 'This item has no test cases.' };
  }
  const variant = item.languages[language];
  if (!variant) {
    return { total: 0, passed: 0, allPassed: false, results: [], fatalError: `Not available in ${language}.` };
  }

  const normalize = item.normalize ?? ((v: unknown) => v);

  const { expected, error: expectedError } = await computeExpected(item, language, signal);
  if (signal?.aborted) return null;
  if (expectedError) {
    if (expectedError === 'aborted') return null;
    return { total: item.testCases.length, passed: 0, allPassed: false, results: [], fatalError: expectedError };
  }

  const results: CaseResult[] = [];
  for (let i = 0; i < item.testCases.length; i++) {
    const testCase = item.testCases[i];
    const result = await runCase(code, language, variant.entryFunction, testCase, signal);
    if (result === null) return null;

    const hidden = Boolean(testCase.hidden);
    const base: CaseResult = { index: i, passed: false, hidden };
    if (!hidden) {
      base.input = testCase.label ?? renderArgs(testCase.args);
      base.expected = formatValue(normalize(expected[i]));
    }

    if (result.error) {
      results.push({ ...base, error: result.error, stdout: result.stdout || undefined });
      continue;
    }

    const actual = normalize(result.returnValue);
    const passed = resultsMatch(actual, normalize(expected[i]), item.compare);
    results.push({
      ...base,
      passed,
      actual: hidden ? undefined : formatValue(actual),
      stdout: result.stdout || undefined,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, allPassed: passed === results.length, results };
}
