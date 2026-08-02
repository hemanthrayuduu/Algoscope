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

export const DEFAULT_ITEM_ID = 'two-sum';

export function getItem(id: string): LibraryItem {
  return LIBRARY.find((item) => item.id === id) ?? LIBRARY[0];
}

/**
 * Items that support `language`, grouped for the picker. Grouping by kind
 * keeps "things to solve" and "things to watch" visually distinct without
 * needing separate modes.
 */
export function groupedFor(language: Language): { label: string; items: LibraryItem[] }[] {
  const supported = LIBRARY.filter((item) => item.languages[language]);
  return [
    { label: 'Challenges — solve and submit', items: supported.filter((i) => i.kind === 'challenge') },
    { label: 'Demos — watch how it works', items: supported.filter((i) => i.kind === 'demo') },
    { label: 'Your own code', items: supported.filter((i) => i.kind === 'scratch') },
  ].filter((group) => group.items.length > 0);
}

export { CHALLENGES, DEMOS };
export * from './types';
