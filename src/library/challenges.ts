// Judgeable items: a statement, constraints, and test cases.
//
// Every challenge ships a reference solution in both languages. Those are the
// source of truth for expected outputs (see judge/judge.ts) and are themselves
// verified by the test suite, so a malformed challenge fails CI rather than
// silently marking correct submissions wrong.
//
// The JavaScript reference solutions stay inside the subset the built-in
// interpreter supports (no classes, no try/catch) so that what we ship is
// always runnable by the same engine users' code runs on.

import type { LibraryItem } from './types';

export const CHALLENGES: LibraryItem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    kind: 'challenge',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Map'],
    description:
      'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    constraints: ['2 <= nums.length <= 1000', '-10^9 <= nums[i] <= 10^9', 'Exactly one valid answer exists.'],
    examples: [
      {
        args: [[2, 7, 11, 15], 9],
        inputLabel: 'nums = [2,7,11,15], target = 9',
        outputLabel: '[0,1]',
        explanation: 'nums[0] + nums[1] === 9, so the answer is [0,1].',
      },
      { args: [[3, 2, 4], 6], inputLabel: 'nums = [3,2,4], target = 6', outputLabel: '[1,2]' },
    ],
    previewArgs: '[[2,7,11,15],9]',
    languages: {
      javascript: {
        entryFunction: 'twoSum',
        code: `function twoSum(nums, target) {
  // Return the indices of the two numbers that add up to target.

}`,
        referenceSolution: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}`,
      },
      python: {
        entryFunction: 'two_sum',
        code: `def two_sum(nums, target):
    # Return the indices of the two numbers that add up to target.
    pass`,
        referenceSolution: `def two_sum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return [seen[complement], i]
        seen[value] = i
    return []`,
      },
    },
    // Either ordering of the index pair is correct.
    compare: 'unordered',
    testCases: [
      { args: [[2, 7, 11, 15], 9] },
      { args: [[3, 2, 4], 6] },
      { args: [[3, 3], 6] },
      { args: [[-1, -2, -3, -4, -5], -8] },
      { args: [[0, 4, 3, 0], 0] },
      { args: [[1, 5], 6] },
      { args: [[10, 20, 30, 40, 50, 60], 110], hidden: true },
    ],
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
  },

  {
    id: 'binary-search',
    title: 'Binary Search',
    kind: 'challenge',
    difficulty: 'Easy',
    topics: ['Array', 'Binary Search'],
    description:
      'Given a sorted array of distinct integers nums and an integer target, return the index of target if it is in the array, or -1 if it is not.\n\nYour solution should run in O(log n) time.',
    constraints: ['1 <= nums.length <= 10000', 'nums is sorted in ascending order', 'All values are distinct'],
    examples: [
      {
        args: [[-1, 0, 3, 5, 9, 12], 9],
        inputLabel: 'nums = [-1,0,3,5,9,12], target = 9',
        outputLabel: '4',
        explanation: '9 lives at index 4.',
      },
      {
        args: [[-1, 0, 3, 5, 9, 12], 2],
        inputLabel: 'nums = [-1,0,3,5,9,12], target = 2',
        outputLabel: '-1',
        explanation: '2 is not in the array.',
      },
    ],
    previewArgs: '[[-1,0,3,5,9,12],9]',
    languages: {
      javascript: {
        entryFunction: 'search',
        code: `function search(nums, target) {
  // Return the index of target, or -1 if it isn't present.

}`,
        referenceSolution: `function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
      },
      python: {
        entryFunction: 'search',
        code: `def search(nums, target):
    # Return the index of target, or -1 if it isn't present.
    pass`,
        referenceSolution: `def search(nums, target):
    lo = 0
    hi = len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
      },
    },
    compare: 'exact',
    testCases: [
      { args: [[-1, 0, 3, 5, 9, 12], 9] },
      { args: [[-1, 0, 3, 5, 9, 12], 2] },
      { args: [[5], 5] },
      { args: [[5], -5] },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8], 1] },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8], 8] },
      { args: [[2, 4, 6, 8, 10], 7], hidden: true },
    ],
    timeComplexity: 'O(log n)',
    spaceComplexity: 'O(1)',
  },

  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    kind: 'challenge',
    difficulty: 'Easy',
    topics: ['String', 'Stack'],
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nA string is valid when open brackets are closed by the same type of bracket and in the correct order.",
    constraints: ['1 <= s.length <= 10000', 's consists only of bracket characters'],
    examples: [
      { args: ['()[]{}'], inputLabel: 's = "()[]{}"', outputLabel: 'true' },
      { args: ['(]'], inputLabel: 's = "(]"', outputLabel: 'false', explanation: 'Brackets close in the wrong order.' },
      { args: ['([{}])'], inputLabel: 's = "([{}])"', outputLabel: 'true' },
    ],
    previewArgs: '["([{}])"]',
    languages: {
      javascript: {
        entryFunction: 'isValid',
        code: `function isValid(s) {
  // Return true if every bracket is closed correctly.

}`,
        referenceSolution: `function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else {
      if (stack.length === 0) return false;
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}`,
      },
      python: {
        entryFunction: 'is_valid',
        code: `def is_valid(s):
    # Return True if every bracket is closed correctly.
    pass`,
        referenceSolution: `def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        else:
            if not stack:
                return False
            if stack.pop() != pairs[ch]:
                return False
    return len(stack) == 0`,
      },
    },
    compare: 'exact',
    testCases: [
      { args: ['()[]{}'] },
      { args: ['(]'] },
      { args: ['([{}])'] },
      { args: ['('] },
      { args: [')'] },
      { args: ['(('] },
      { args: ['([)]'] },
      { args: ['{[]}'] },
      { args: ['(((((((((())))))))))'], hidden: true },
    ],
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
  },

  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    kind: 'challenge',
    difficulty: 'Easy',
    topics: ['Linked List'],
    description:
      'Given the values of a singly linked list, reverse the list and return its new head.\n\nA buildList helper is provided in the starter code: it turns an array of values into a linked list, so you can focus on the reversal itself. Each node has a val and a next.',
    constraints: ['0 <= number of nodes <= 500', '-1000 <= Node.val <= 1000'],
    examples: [
      {
        args: [[1, 2, 3, 4, 5]],
        inputLabel: 'values = [1,2,3,4,5]',
        outputLabel: '5 -> 4 -> 3 -> 2 -> 1',
        explanation: 'The list is reversed in place by flipping each next pointer.',
      },
      { args: [[1, 2]], inputLabel: 'values = [1,2]', outputLabel: '2 -> 1' },
    ],
    previewArgs: '[[1,2,3,4,5]]',
    languages: {
      javascript: {
        entryFunction: 'solve',
        code: `function buildList(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) {
    head = { val: values[i], next: head };
  }
  return head;
}

function reverseList(head) {
  // Reverse the list and return the new head.

}

function solve(values) {
  return reverseList(buildList(values));
}`,
        referenceSolution: `function buildList(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) {
    head = { val: values[i], next: head };
  }
  return head;
}

function reverseList(head) {
  let prev = null;
  while (head !== null) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

function solve(values) {
  return reverseList(buildList(values));
}`,
      },
      python: {
        entryFunction: 'solve',
        code: `class ListNode:
    def __init__(self, val, nxt=None):
        self.val = val
        self.next = nxt

def build_list(values):
    head = None
    for v in reversed(values):
        head = ListNode(v, head)
    return head

def reverse_list(head):
    # Reverse the list and return the new head.
    pass

def solve(values):
    return reverse_list(build_list(values))`,
        referenceSolution: `class ListNode:
    def __init__(self, val, nxt=None):
        self.val = val
        self.next = nxt

def build_list(values):
    head = None
    for v in reversed(values):
        head = ListNode(v, head)
    return head

def reverse_list(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev

def solve(values):
    return reverse_list(build_list(values))`,
      },
    },
    compare: 'exact',
    // Returned value is a node chain; flatten to an array so JS objects and
    // Python ListNode instances compare identically.
    normalize: flattenLinkedList,
    testCases: [
      { args: [[1, 2, 3, 4, 5]] },
      { args: [[1, 2]] },
      { args: [[7]] },
      { args: [[]] },
      { args: [[-3, 0, 3, 9]] },
      { args: [[1, 1, 2, 2]], hidden: true },
    ],
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
  },

  {
    id: 'max-depth-binary-tree',
    title: 'Maximum Depth of Binary Tree',
    kind: 'challenge',
    difficulty: 'Easy',
    topics: ['Tree', 'Recursion'],
    description:
      'Given a binary tree described in level order (with null for missing children), return its maximum depth — the number of nodes along the longest path from the root down to the farthest leaf.\n\nA buildTree helper is provided in the starter code, so you only need to write the depth calculation. Each node has a val, a left and a right.',
    constraints: ['0 <= number of nodes <= 2000', '-100 <= Node.val <= 100'],
    examples: [
      {
        args: [[3, 9, 20, null, null, 15, 7]],
        inputLabel: 'values = [3,9,20,null,null,15,7]',
        outputLabel: '3',
        explanation: 'The longest path is 3 -> 20 -> 15 (or 3 -> 20 -> 7), which visits 3 nodes.',
      },
      { args: [[1, null, 2]], inputLabel: 'values = [1,null,2]', outputLabel: '2' },
    ],
    previewArgs: '[[3,9,20,null,null,15,7]]',
    languages: {
      javascript: {
        entryFunction: 'solve',
        code: `function buildTree(values) {
  if (values.length === 0) return null;
  const nodes = [];
  for (const v of values) {
    nodes.push(v === null ? null : { val: v, left: null, right: null });
  }
  let child = 1;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] !== null) {
      if (child < nodes.length) { nodes[i].left = nodes[child]; child++; }
      if (child < nodes.length) { nodes[i].right = nodes[child]; child++; }
    }
  }
  return nodes[0];
}

function maxDepth(root) {
  // Return the maximum depth of the tree.

}

function solve(values) {
  return maxDepth(buildTree(values));
}`,
        referenceSolution: `function buildTree(values) {
  if (values.length === 0) return null;
  const nodes = [];
  for (const v of values) {
    nodes.push(v === null ? null : { val: v, left: null, right: null });
  }
  let child = 1;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] !== null) {
      if (child < nodes.length) { nodes[i].left = nodes[child]; child++; }
      if (child < nodes.length) { nodes[i].right = nodes[child]; child++; }
    }
  }
  return nodes[0];
}

function maxDepth(root) {
  if (root === null) return 0;
  const left = maxDepth(root.left);
  const right = maxDepth(root.right);
  return 1 + Math.max(left, right);
}

function solve(values) {
  return maxDepth(buildTree(values));
}`,
      },
      python: {
        entryFunction: 'solve',
        code: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None

def build_tree(values):
    if not values:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in values]
    child = 1
    for node in nodes:
        if node is not None:
            if child < len(nodes):
                node.left = nodes[child]
                child += 1
            if child < len(nodes):
                node.right = nodes[child]
                child += 1
    return nodes[0]

def max_depth(root):
    # Return the maximum depth of the tree.
    pass

def solve(values):
    return max_depth(build_tree(values))`,
        referenceSolution: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None

def build_tree(values):
    if not values:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in values]
    child = 1
    for node in nodes:
        if node is not None:
            if child < len(nodes):
                node.left = nodes[child]
                child += 1
            if child < len(nodes):
                node.right = nodes[child]
                child += 1
    return nodes[0]

def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

def solve(values):
    return max_depth(build_tree(values))`,
      },
    },
    compare: 'exact',
    testCases: [
      { args: [[3, 9, 20, null, null, 15, 7]] },
      { args: [[1, null, 2]] },
      { args: [[]] },
      { args: [[1]] },
      { args: [[1, 2, 3, 4, 5, 6, 7]] },
      { args: [[1, 2, null, 3, null, 4]], hidden: true },
    ],
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(h)',
  },

  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    kind: 'challenge',
    difficulty: 'Medium',
    topics: ['Array', 'Sorting'],
    description:
      'Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    constraints: ['1 <= intervals.length <= 1000', 'intervals[i].length === 2', 'start <= end'],
    examples: [
      {
        args: [
          [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        ],
        inputLabel: 'intervals = [[1,3],[2,6],[8,10],[15,18]]',
        outputLabel: '[[1,6],[8,10],[15,18]]',
        explanation: '[1,3] and [2,6] overlap, so they merge into [1,6].',
      },
      {
        args: [
          [
            [1, 4],
            [4, 5],
          ],
        ],
        inputLabel: 'intervals = [[1,4],[4,5]]',
        outputLabel: '[[1,5]]',
        explanation: 'Intervals that just touch are still considered overlapping.',
      },
    ],
    previewArgs: '[[[1,3],[2,6],[8,10],[15,18]]]',
    languages: {
      javascript: {
        entryFunction: 'merge',
        code: `function merge(intervals) {
  // Merge all overlapping intervals.

}`,
        referenceSolution: `function merge(intervals) {
  const sorted = intervals.slice().sort(function (a, b) {
    return a[0] - b[0];
  });
  const result = [];
  for (const interval of sorted) {
    if (result.length === 0) {
      result.push([interval[0], interval[1]]);
    } else {
      const last = result[result.length - 1];
      if (interval[0] <= last[1]) {
        last[1] = Math.max(last[1], interval[1]);
      } else {
        result.push([interval[0], interval[1]]);
      }
    }
  }
  return result;
}`,
      },
      python: {
        entryFunction: 'merge',
        code: `def merge(intervals):
    # Merge all overlapping intervals.
    pass`,
        referenceSolution: `def merge(intervals):
    result = []
    for interval in sorted(intervals, key=lambda x: x[0]):
        if result and interval[0] <= result[-1][1]:
            result[-1][1] = max(result[-1][1], interval[1])
        else:
            result.append([interval[0], interval[1]])
    return result`,
      },
    },
    compare: 'exact',
    testCases: [
      {
        args: [
          [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        ],
      },
      {
        args: [
          [
            [1, 4],
            [4, 5],
          ],
        ],
      },
      { args: [[[1, 4]]] },
      {
        args: [
          [
            [1, 4],
            [0, 4],
          ],
        ],
      },
      {
        args: [
          [
            [1, 4],
            [2, 3],
          ],
        ],
      },
      {
        args: [
          [
            [5, 6],
            [1, 3],
            [8, 9],
          ],
        ],
      },
      {
        args: [
          [
            [1, 10],
            [2, 3],
            [4, 5],
            [6, 7],
          ],
        ],
        hidden: true,
      },
    ],
    timeComplexity: 'O(n log n)',
    spaceComplexity: 'O(n)',
  },
];

/**
 * Converts a returned linked list (a chain of `{ val, next }` objects, or of
 * Python ListNode instances) into a plain array of values so results from both
 * languages compare identically. Guards against cycles introduced by a buggy
 * submission rather than looping forever.
 */
function flattenLinkedList(value: unknown): unknown {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  let node: any = value;
  while (node && typeof node === 'object') {
    if (seen.has(node)) {
      out.push('<cycle>');
      break;
    }
    seen.add(node);
    const fields = node.__kind === 'object' ? node.fields : node;
    if (!fields || !('val' in fields)) break;
    out.push(fields.val);
    node = fields.next;
    if (out.length > 10000) break;
  }
  return out;
}
