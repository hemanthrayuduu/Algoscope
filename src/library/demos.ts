// Worked implementations to read and step through. Nothing to submit — the
// point is watching a known-correct algorithm operate on its data.
//
// These deliberately don't overlap with the challenges: an algorithm is either
// something you're asked to write, or something you're shown. Duplicating one
// as both just made the library confusing.
//
// Every demo is written in both languages, and the test suite asserts each one
// actually runs without error in each language it declares.

import type { LibraryItem } from './types';

export const DEMOS: LibraryItem[] = [
  {
    id: 'bubble-sort',
    title: 'Bubble Sort',
    kind: 'demo',
    topics: ['Sorting'],
    description:
      'Repeatedly compares adjacent elements and swaps them when they are out of order, so large values "bubble" toward the end. Watch the swaps happen cell by cell — the highlighted cells are the ones that just changed.',
    previewArgs: '[[5,2,9,1,5,6]]',
    languages: {
      javascript: {
        entryFunction: 'bubbleSort',
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
      python: {
        entryFunction: 'bubble_sort',
        code: `def bubble_sort(arr):
    for i in range(len(arr)):
        for j in range(len(arr) - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
      },
    },
    timeComplexity: 'O(n²)',
    spaceComplexity: 'O(1)',
  },

  {
    id: 'quicksort',
    title: 'Quicksort',
    kind: 'demo',
    topics: ['Sorting', 'Recursion'],
    description:
      'Picks a pivot, splits the values into smaller and larger halves, then sorts each half recursively. The call stack panel shows the recursion building up and unwinding.',
    previewArgs: '[[8,3,1,7,0,10,2]]',
    languages: {
      javascript: {
        entryFunction: 'quicksort',
        code: `function quicksort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return quicksort(left).concat(middle).concat(quicksort(right));
}`,
      },
      python: {
        entryFunction: 'quicksort',
        code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`,
      },
    },
    timeComplexity: 'O(n log n) average',
    spaceComplexity: 'O(n)',
  },

  {
    id: 'fibonacci-memo',
    title: 'Fibonacci (Memoized)',
    kind: 'demo',
    topics: ['Dynamic Programming', 'Recursion'],
    description:
      'Top-down dynamic programming: results are cached in a memo so each value is computed once. Step through and watch the memo fill in — and how often it saves a whole subtree of work.',
    previewArgs: '[10,{}]',
    languages: {
      javascript: {
        entryFunction: 'fib',
        code: `function fib(n, memo) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
  return memo[n];
}`,
      },
      python: {
        entryFunction: 'fib',
        code: `def fib(n, memo):
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]`,
      },
    },
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
  },

  {
    id: 'kadane',
    title: 'Maximum Subarray (Kadane)',
    kind: 'demo',
    topics: ['Dynamic Programming', 'Array'],
    description:
      'Tracks the best sum ending at each index, restarting whenever the running total would drag the next element down. One pass, no extra space — watch current and best diverge.',
    previewArgs: '[[-2,1,-3,4,-1,2,1,-5,4]]',
    languages: {
      javascript: {
        entryFunction: 'maxSubArray',
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
      python: {
        entryFunction: 'max_sub_array',
        code: `def max_sub_array(nums):
    best = nums[0]
    current = nums[0]
    for i in range(1, len(nums)):
        current = max(nums[i], current + nums[i])
        best = max(best, current)
    return best`,
      },
    },
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
  },

  {
    id: 'build-bst',
    title: 'Build a Binary Search Tree',
    kind: 'demo',
    topics: ['Tree'],
    description:
      'Inserts values one at a time, walking left for smaller and right for larger. The tree redraws after every insert, so you can see the shape the input order produces.',
    previewArgs: '[[5,3,8,1,4,7,9,2]]',
    languages: {
      javascript: {
        entryFunction: 'solve',
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
      python: {
        entryFunction: 'solve',
        code: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None

def insert(root, value):
    if root is None:
        return TreeNode(value)
    if value < root.val:
        root.left = insert(root.left, value)
    else:
        root.right = insert(root.right, value)
    return root

def solve(values):
    root = None
    for v in values:
        root = insert(root, v)
    return root`,
      },
    },
    timeComplexity: 'O(n log n) average',
    spaceComplexity: 'O(n)',
  },

  {
    id: 'graph-dfs',
    title: 'Graph DFS',
    kind: 'demo',
    topics: ['Graph', 'Stack'],
    description:
      'Depth-first traversal of an adjacency list using an explicit stack. Watch the stack grow and drain, and the visited list fill in the order nodes are reached.',
    previewArgs: '[{"A":["B","C"],"B":["D"],"C":["D","E"],"D":[],"E":[]},"A"]',
    languages: {
      javascript: {
        entryFunction: 'dfs',
        code: `function dfs(graph, start) {
  const visited = [];
  const stack = [start];
  const seen = new Set();
  while (stack.length > 0) {
    const node = stack.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    visited.push(node);
    const neighbors = graph[node];
    for (let i = neighbors.length - 1; i >= 0; i--) {
      if (!seen.has(neighbors[i])) {
        stack.push(neighbors[i]);
      }
    }
  }
  return visited;
}`,
      },
      python: {
        entryFunction: 'dfs',
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
    },
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
  },

  {
    id: 'sliding-window',
    title: 'Sliding Window Maximum Sum',
    kind: 'demo',
    topics: ['Two Pointer', 'Array'],
    description:
      'Keeps a running sum of a fixed-size window, adding the element entering and subtracting the one leaving instead of re-summing. Watch the window total update in a single step per slide.',
    previewArgs: '[[2,1,5,1,3,2],3]',
    languages: {
      javascript: {
        entryFunction: 'maxWindow',
        code: `function maxWindow(nums, k) {
  let window = 0;
  for (let i = 0; i < k; i++) {
    window += nums[i];
  }
  let best = window;
  for (let i = k; i < nums.length; i++) {
    window += nums[i] - nums[i - k];
    best = Math.max(best, window);
  }
  return best;
}`,
      },
      python: {
        entryFunction: 'max_window',
        code: `def max_window(nums, k):
    window = sum(nums[:k])
    best = window
    for i in range(k, len(nums)):
        window += nums[i] - nums[i - k]
        best = max(best, window)
    return best`,
      },
    },
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
  },
];
