// Built-in example library. Each example is self-contained: source code, the
// function to invoke, and JSON arguments, plus a category and complexity note
// shown in the UI. JS examples stay within the built-in interpreter's supported
// subset; Python examples run on real CPython via Pyodide.

import type { Language } from '../engine/types';

export interface Example {
  id: string;
  title: string;
  category: string;
  language: Language;
  time: string;
  space: string;
  description: string;
  code: string;
  entryFunction: string;
  argsJson: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'js-two-sum',
    title: 'Two Sum',
    category: 'Hash Map',
    language: 'javascript',
    time: 'O(n)',
    space: 'O(n)',
    description: 'Find two indices whose values add up to the target using a hash map of seen values.',
    entryFunction: 'twoSum',
    argsJson: '[[2, 7, 11, 15], 9]',
    code: `function twoSum(nums, target) {
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
  {
    id: 'js-binary-search',
    title: 'Binary Search',
    category: 'Searching',
    language: 'javascript',
    time: 'O(log n)',
    space: 'O(1)',
    description: 'Locate a target in a sorted array by repeatedly halving the search range.',
    entryFunction: 'search',
    argsJson: '[[1, 3, 5, 7, 9, 11, 13], 9]',
    code: `function search(nums, target) {
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
  {
    id: 'js-bubble-sort',
    title: 'Bubble Sort',
    category: 'Sorting',
    language: 'javascript',
    time: 'O(n²)',
    space: 'O(1)',
    description: 'Repeatedly swap adjacent out-of-order elements so large values bubble to the end.',
    entryFunction: 'bubbleSort',
    argsJson: '[[5, 2, 9, 1, 5, 6]]',
    code: `function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}`,
  },
  {
    id: 'js-reverse-list',
    title: 'Reverse a Linked List',
    category: 'Linked List',
    language: 'javascript',
    time: 'O(n)',
    space: 'O(1)',
    description: 'Build a linked list from an array, then reverse its pointers in place.',
    entryFunction: 'solve',
    argsJson: '[[1, 2, 3, 4, 5]]',
    code: `function buildList(arr) {
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) {
    head = { val: arr[i], next: head };
  }
  return head;
}

function reverseList(head) {
  let prev = null;
  while (head) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

function solve(arr) {
  const list = buildList(arr);
  return reverseList(list);
}`,
  },
  {
    id: 'js-bst',
    title: 'Build a Binary Search Tree',
    category: 'Tree',
    language: 'javascript',
    time: 'O(n log n)',
    space: 'O(n)',
    description: 'Insert values one by one into a BST and watch the tree take shape.',
    entryFunction: 'solve',
    argsJson: '[[5, 3, 8, 1, 4, 7, 9, 2]]',
    code: `function insert(root, value) {
  if (root === null) {
    return { val: value, left: null, right: null };
  }
  if (value < root.val) root.left = insert(root.left, value);
  else root.right = insert(root.right, value);
  return root;
}

function solve(values) {
  let root = null;
  for (const v of values) {
    root = insert(root, v);
  }
  return root;
}`,
  },
  {
    id: 'js-fib-memo',
    title: 'Fibonacci (Memoized)',
    category: 'Dynamic Programming',
    language: 'javascript',
    time: 'O(n)',
    space: 'O(n)',
    description: 'Top-down dynamic programming with a memo object to avoid recomputation.',
    entryFunction: 'fib',
    argsJson: '[10, {}]',
    code: `function fib(n, memo) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
  return memo[n];
}`,
  },
  {
    id: 'js-valid-parens',
    title: 'Valid Parentheses',
    category: 'Stack',
    language: 'javascript',
    time: 'O(n)',
    space: 'O(n)',
    description: 'Use a stack to check that every bracket is closed in the right order.',
    entryFunction: 'isValid',
    argsJson: '["([]{()})"]',
    code: `function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}`,
  },
  {
    id: 'js-kadane',
    title: 'Maximum Subarray (Kadane)',
    category: 'Dynamic Programming',
    language: 'javascript',
    time: 'O(n)',
    space: 'O(1)',
    description: 'Track the best subarray sum ending at each index to find the global maximum.',
    entryFunction: 'maxSubArray',
    argsJson: '[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]',
    code: `function maxSubArray(nums) {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}`,
  },
  {
    id: 'py-two-sum',
    title: 'Two Sum',
    category: 'Hash Map',
    language: 'python',
    time: 'O(n)',
    space: 'O(n)',
    description: 'The classic hash-map approach, in Python running on real CPython (Pyodide).',
    entryFunction: 'two_sum',
    argsJson: '[[2, 7, 11, 15], 9]',
    code: `def two_sum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return [seen[complement], i]
        seen[value] = i
    return []`,
  },
  {
    id: 'py-quicksort',
    title: 'Quicksort',
    category: 'Sorting',
    language: 'python',
    time: 'O(n log n) avg',
    space: 'O(n)',
    description: 'Recursive quicksort partitioning around a pivot. Watch the recursion build up.',
    entryFunction: 'quicksort',
    argsJson: '[[8, 3, 1, 7, 0, 10, 2]]',
    code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`,
  },
  {
    id: 'py-linked-list',
    title: 'Reverse a Linked List',
    category: 'Linked List',
    language: 'python',
    time: 'O(n)',
    space: 'O(1)',
    description: 'A ListNode class reversed in place — instances render as a node-link chain.',
    entryFunction: 'solve',
    argsJson: '[[1, 2, 3, 4]]',
    code: `class ListNode:
    def __init__(self, val, nxt=None):
        self.val = val
        self.next = nxt

def build(values):
    head = None
    for v in reversed(values):
        head = ListNode(v, head)
    return head

def reverse(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev

def solve(values):
    return reverse(build(values))`,
  },
  {
    id: 'py-tree-depth',
    title: 'Binary Tree Max Depth',
    category: 'Tree',
    language: 'python',
    time: 'O(n)',
    space: 'O(h)',
    description: 'Build a small binary tree and compute its depth with recursion.',
    entryFunction: 'solve',
    argsJson: '[[3, 9, 20, null, null, 15, 7]]',
    code: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None

def build(values):
    if not values:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in values]
    kids = nodes[1:][::-1]
    for node in nodes:
        if node:
            if kids:
                node.left = kids.pop()
            if kids:
                node.right = kids.pop()
    return nodes[0]

def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

def solve(values):
    root = build(values)
    return max_depth(root)`,
  },
  {
    id: 'py-graph-dfs',
    title: 'Graph DFS',
    category: 'Graph',
    language: 'python',
    time: 'O(V + E)',
    space: 'O(V)',
    description: 'Depth-first traversal of an adjacency-list graph, collecting visit order.',
    entryFunction: 'dfs',
    argsJson: '[{"A": ["B", "C"], "B": ["D"], "C": ["D", "E"], "D": [], "E": []}, "A"]',
    code: `def dfs(graph, start):
    visited = []
    stack = [start]
    seen = set()
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)
        for neighbor in reversed(graph[node]):
            if neighbor not in seen:
                stack.append(neighbor)
    return visited`,
  },
  {
    id: 'py-sliding-window',
    title: 'Sliding Window Max Sum',
    category: 'Two Pointer',
    language: 'python',
    time: 'O(n)',
    space: 'O(1)',
    description: 'Maximum sum of any window of size k, maintained as the window slides.',
    entryFunction: 'max_window',
    argsJson: '[[2, 1, 5, 1, 3, 2], 3]',
    code: `def max_window(nums, k):
    window = sum(nums[:k])
    best = window
    for i in range(k, len(nums)):
        window += nums[i] - nums[i - k]
        best = max(best, window)
    return best`,
  },
];

export const DEFAULT_EXAMPLE_ID = 'js-two-sum';

export function getExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
}
