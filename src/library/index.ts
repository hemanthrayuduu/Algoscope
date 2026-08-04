// The complete library, in the order it appears in the picker.

import { CHALLENGES } from './challenges';
import { DEMOS } from './demos';
import type { LibraryItem } from './types';
import type { Language } from '../engine/types';

/** An empty buffer, for when you just want to run something of your own. */
export const SCRATCH: LibraryItem = {
  id: 'scratch',
  title: 'Blank scratchpad',
  kind: 'scratch',
  topics: [],
  description:
    'An empty buffer. Write any function, set its arguments, and watch it run. Everything you type is visualized the same way as the rest of the library.',
  previewArgs: '[[3,1,4,1,5,9,2,6]]',
  languages: {
    javascript: {
      entryFunction: 'solve',
      code: `function solve(input) {
  // Write anything here, then set the arguments below.
  let result = 0;
  for (const value of input) {
    result += value;
  }
  return result;
}`,
    },
    python: {
      entryFunction: 'solve',
      code: `def solve(input):
    # Write anything here, then set the arguments below.
    result = 0
    for value in input:
        result += value
    return result`,
    },
  },
};

export const LIBRARY: LibraryItem[] = [...CHALLENGES, ...DEMOS, SCRATCH];

/**
 * What loads on a cold visit.
 *
 * A demo rather than a challenge, deliberately: a challenge opens as an empty
 * stub, so the first thing a visitor saw was a blank editor and a still
 * visualization. Bubble sort animates immediately — swapping cells, with the i
 * and j cursors moving — which is the thing the app is actually for.
 */
export const DEFAULT_ITEM_ID = 'bubble-sort';

export function getItem(id: string): LibraryItem {
  return LIBRARY.find((item) => item.id === id) ?? LIBRARY[0];
}

/**
 * Items that support `language`, grouped for the picker. Grouping by kind
 * keeps "things to solve" and "things to watch" visually distinct without
 * needing separate modes.
 */
export function groupedFor(language: Language): { label: string; items: LibraryItem[] }[] {
  return groupItems(LIBRARY.filter((item) => item.languages[language]));
}

/** Splits an already-filtered set of items into the three display groups. */
export function groupItems(items: LibraryItem[]): { label: string; items: LibraryItem[] }[] {
  return [
    { label: 'Challenges — solve and submit', items: items.filter((i) => i.kind === 'challenge') },
    { label: 'Demos — watch how it works', items: items.filter((i) => i.kind === 'demo') },
    { label: 'Your own code', items: items.filter((i) => i.kind === 'scratch') },
  ].filter((group) => group.items.length > 0);
}

/**
 * Free-text search across the library. Matches title, topics, difficulty and
 * description so "tree", "medium" and "hash" all find something useful. An
 * empty query returns everything available in `language`.
 */
export function searchLibrary(query: string, language: Language): LibraryItem[] {
  const available = LIBRARY.filter((item) => item.languages[language]);
  const q = query.trim().toLowerCase();
  if (!q) return available;

  return available.filter((item) => {
    const haystack = [item.title, item.difficulty ?? '', item.kind, ...item.topics, item.description]
      .join(' ')
      .toLowerCase();
    // Every whitespace-separated term must appear somewhere, so "easy tree"
    // narrows rather than widening.
    return q.split(/\s+/).every((term) => haystack.includes(term));
  });
}

/**
 * The item before/after `id` in library order, for stepping through without
 * opening the browser. Returns null at the ends rather than wrapping, so the
 * controls can disable themselves.
 */
export function neighbours(id: string, language: Language): { prev: LibraryItem | null; next: LibraryItem | null } {
  const available = LIBRARY.filter((item) => item.languages[language]);
  const index = available.findIndex((item) => item.id === id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? available[index - 1] : null,
    next: index < available.length - 1 ? available[index + 1] : null,
  };
}

export { CHALLENGES, DEMOS };
export * from './types';
