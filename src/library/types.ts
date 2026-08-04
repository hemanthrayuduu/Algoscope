// The library: everything you can load into the workspace.
//
// There is one item type rather than separate "examples" and "problems",
// because the workspace is the same either way — code on one side, its
// execution visualized on the other. What varies is only how much scaffolding
// an item carries:
//
//   challenge  a statement, constraints, and test cases; can be submitted and
//              judged
//   demo       a worked implementation to read and step through; nothing to
//              submit
//   scratch    an empty buffer
//
// Anything with `testCases` is judgeable; anything without simply runs. That
// single distinction replaces what used to be a mode switch.

import type { Language } from '../engine/types';

/**
 * How a submitted result is compared with the expected one.
 *
 * Many problems admit more than one correct answer, so strict deep equality
 * would reject valid solutions — the fastest way to lose a user's trust.
 *
 * - `exact`      deep equality, order-sensitive (most problems)
 * - `unordered`  deep equality after canonical sorting, recursively
 * - `set`        same elements, ignoring order and duplicates
 */
export type CompareMode = 'exact' | 'unordered' | 'set';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ItemKind = 'challenge' | 'demo' | 'scratch';

export interface WorkedExample {
  /** Positional arguments, shown to the user and used for the live preview. */
  args: unknown[];
  /** Human-readable input, e.g. "nums = [2,7,11,15], target = 9". */
  inputLabel: string;
  /** Human-readable expected output, e.g. "[0,1]". */
  outputLabel: string;
  explanation?: string;
}

export interface TestCase {
  args: unknown[];
  /**
   * Expected result. Normally omitted and derived by running the reference
   * solution; set it explicitly only to pin a specific value.
   */
  expected?: unknown;
  /** Shown instead of raw args for very large inputs. */
  label?: string;
  /** Hidden cases still run, but their inputs aren't revealed on failure. */
  hidden?: boolean;
}

/** Per-language content. An item may support one language or both. */
export interface LanguageVariant {
  /** What lands in the editor: a stub for challenges, full code for demos. */
  code: string;
  /** The function the runner and judge invoke. */
  entryFunction: string;
  /** Known-good solution. Required for challenges; unused for demos. */
  referenceSolution?: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  kind: ItemKind;
  topics: string[];
  /** Shown for challenges; omitted for demos and scratch. */
  difficulty?: Difficulty;
  /** Prose statement for challenges, or a short explanation for demos. */
  description: string;
  constraints?: string[];
  examples?: WorkedExample[];
  languages: Partial<Record<Language, LanguageVariant>>;
  /** Arguments used for the live preview, as a JSON array string. */
  previewArgs: string;
  /**
   * What lands in the editor when the item opens.
   *
   * `starter` (the default) gives the stub, so the challenge can be attempted.
   * `solution` opens with the worked solution already running — useful for the
   * canonical problems, where seeing a correct implementation animate teaches
   * more than an empty function does. Either way the Solution/Starter toggle
   * switches between them.
   */
  openWith?: 'starter' | 'solution';
  /** Present only on challenges — their presence is what makes an item judgeable. */
  testCases?: TestCase[];
  compare?: CompareMode;
  /**
   * Some challenges return a structure (e.g. a linked list) that is easier to
   * compare after flattening. Applied to both actual and expected.
   */
  normalize?: (value: unknown) => unknown;
  timeComplexity?: string;
  spaceComplexity?: string;
}

/** Items with test cases can be submitted and judged. */
export function isJudgeable(
  item: LibraryItem,
): item is LibraryItem & { testCases: TestCase[]; compare: CompareMode } {
  return Array.isArray(item.testCases) && item.testCases.length > 0;
}

export function supportsLanguage(item: LibraryItem, language: Language): boolean {
  return Boolean(item.languages[language]);
}
