// Problem definitions for the LeetCode-style practice mode.
//
// A problem carries everything needed to (a) present the question, (b) give the
// user a starting point in either language, and (c) decide whether their
// solution is correct. Expected outputs are deliberately NOT hand-written:
// they're produced by running the problem's own reference solution against the
// test inputs, so adding a case only means adding an input.

import type { Language } from '../engine/types';

/**
 * How a submitted result is compared with the expected result.
 *
 * Many problems admit more than one correct answer, so comparing with strict
 * deep equality would reject valid solutions - the fastest way to lose a
 * user's trust. Each problem therefore declares its own notion of "equal".
 *
 * - `exact`      deep equality, order-sensitive (most problems)
 * - `unordered`  deep equality after canonical sorting, at the top level and
 *                within nested arrays (e.g. "return the groups in any order")
 * - `set`        same elements, ignoring order and duplicates
 */
export type CompareMode = 'exact' | 'unordered' | 'set';

export interface Example {
  /** Positional arguments, shown to the user and used for the live preview. */
  args: unknown[];
  /** Human-readable rendering of the input, e.g. "nums = [2,7,11,15], target = 9". */
  inputLabel: string;
  /** Human-readable expected output, e.g. "[0,1]". */
  outputLabel: string;
  explanation?: string;
}

export interface TestCase {
  args: unknown[];
  /**
   * Expected result. Normally omitted and filled in by running the reference
   * solution; set it explicitly only to pin a specific value.
   */
  expected?: unknown;
  /** Shown instead of raw args for very large inputs. */
  label?: string;
  /** Hidden cases still run, but their inputs aren't revealed on failure. */
  hidden?: boolean;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  /** Markdown-ish plain text; rendered as paragraphs. */
  description: string;
  constraints: string[];
  examples: Example[];
  /** Pre-filled editor content per language. */
  starterCode: Record<Language, string>;
  /** Function the judge invokes, per language (naming differs by convention). */
  entryFunction: Record<Language, string>;
  /** Known-good solution; generates expected outputs and validates the problem. */
  referenceSolution: Record<Language, string>;
  testCases: TestCase[];
  compare: CompareMode;
  /**
   * Some problems return a structure (e.g. a linked list) that is easier to
   * compare after flattening. When set, both actual and expected are passed
   * through this before comparison.
   */
  normalize?: (value: unknown) => unknown;
  timeComplexity: string;
  spaceComplexity: string;
}
