// Extractors for different coding problem platforms

/**
 * Factory function to get the appropriate extractor based on the current URL
 * @returns {Object} - The appropriate extractor object
 */
function getExtractor() {
  const url = window.location.href;

  if (url.includes('leetcode.com')) {
    return leetcodeExtractor;
  } else if (url.includes('hackerrank.com')) {
    return hackerrankExtractor;
  }

  throw new Error('Unsupported platform');
}

/**
 * Tries a list of CSS selectors in order and returns the first element found.
 * Frontend frameworks like LeetCode's ship hashed/versioned class names that
 * change frequently, so extraction is best-effort: we try several known
 * shapes and fall back gracefully rather than throwing.
 * @param {string[]} selectors
 * @param {ParentNode} root
 * @returns {Element|null}
 */
function queryFirst(selectors, root = document) {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      if (el) return el;
    } catch (err) {
      // Invalid selector for this DOM version; keep trying the rest.
    }
  }
  return null;
}

function cleanupText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/**
 * Best-effort detection of the algorithmic category of a problem, used to
 * pick a sensible default visualization and starter code shape. This is a
 * heuristic over the title/description/tags text, not a guarantee.
 */
const TYPE_KEYWORDS = [
  ['linked list', 'linked-list'],
  ['binary tree', 'tree'],
  ['binary search tree', 'tree'],
  ['tree', 'tree'],
  ['graph', 'graph'],
  ['dynamic programming', 'dynamic-programming'],
  ['sliding window', 'array'],
  ['two pointer', 'array'],
  ['binary search', 'array'],
  ['heap', 'heap'],
  ['priority queue', 'heap'],
  ['stack', 'stack'],
  ['queue', 'queue'],
  ['hash', 'hash-map'],
  ['matrix', 'matrix'],
  ['grid', 'matrix'],
  ['string', 'string'],
  ['array', 'array'],
];

function detectProblemType({ title = '', description = '', tags = [] }) {
  const haystack = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  for (const [keyword, type] of TYPE_KEYWORDS) {
    if (haystack.includes(keyword)) return type;
  }
  return 'other';
}

/**
 * Best-effort parse of "Input: nums = [2,7,11,15], target = 9" style example
 * text into a JSON array of positional arguments, e.g. [[2,7,11,15], 9].
 * Returns null if nothing parseable was found; callers should treat the
 * result as a starting point for the user to edit, not ground truth.
 */
function parseExampleArgs(exampleText) {
  if (!exampleText) return null;
  const inputMatch = exampleText.match(/Input:\s*([\s\S]*?)(?:\n\s*Output:|$)/i);
  const inputLine = inputMatch ? inputMatch[1] : exampleText;

  const valuePattern = /=\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?|true|false|null)/g;
  const values = [];
  let match = valuePattern.exec(inputLine);
  while (match) {
    values.push(match[1].replace(/'/g, '"'));
    match = valuePattern.exec(inputLine);
  }
  if (!values.length) return null;

  try {
    const parsed = JSON.parse(`[${values.join(',')}]`);
    return JSON.stringify(parsed);
  } catch (err) {
    return null;
  }
}

/**
 * Reads the visible text of a Monaco editor instance (LeetCode's code
 * editor). Monaco virtualizes rendering, so only currently-rendered lines
 * are present in the DOM; this captures what's visible and is meant as a
 * convenience prefill, not a guaranteed full read of the buffer.
 */
function extractMonacoStarterCode(root = document) {
  const lineEls = root.querySelectorAll('.monaco-editor .view-lines .view-line');
  if (!lineEls.length) return '';
  const lines = Array.from(lineEls)
    .map((el) => ({ top: parseInt(el.style.top, 10) || 0, text: el.textContent }))
    .sort((a, b) => a.top - b.top)
    .map((l) => l.text);
  return lines.join('\n');
}

/**
 * Extractor for LeetCode problems
 */
const leetcodeExtractor = {
  /**
   * Extracts problem data from a LeetCode problem page
   * @returns {Object} - The extracted problem data
   */
  extractProblem() {
    try {
      const titleElement = queryFirst([
        '[data-cy="question-title"]',
        'div[class*="question-title"]',
        'a[href*="/problems/"] + div',
        'h1',
      ]);
      const title = titleElement ? titleElement.textContent.trim() : '';

      const descriptionContainer = queryFirst([
        '[data-cy="question-content"]',
        'div[data-track-load="description_content"]',
        'div[class*="question-content"]',
      ]) || document;

      const descriptionText = descriptionContainer.textContent
        ? cleanupText(descriptionContainer.textContent)
        : '';

      const examples = [];
      descriptionContainer.querySelectorAll('pre').forEach((block) => {
        examples.push(block.textContent.trim());
      });

      const constraints = extractConstraints(descriptionContainer);

      const difficultyElement = queryFirst([
        '[diff]',
        'div[class*="difficulty"]',
      ], descriptionContainer.ownerDocument || document);
      let difficulty = difficultyElement ? difficultyElement.textContent.trim() : '';
      if (!difficulty) {
        const match = document.body.textContent.match(/\b(Easy|Medium|Hard)\b/);
        difficulty = match ? match[1] : '';
      }

      const tags = Array.from(
        document.querySelectorAll('a[href^="/tag/"], [data-cy="topic-tag"]')
      ).map((el) => el.textContent.trim()).filter(Boolean);

      const starterCode = extractMonacoStarterCode();
      const suggestedArgs = examples.length ? parseExampleArgs(examples[0]) : null;

      const problemData = {
        title,
        description: descriptionText,
        examples,
        constraints,
        difficulty,
        tags,
        starterCode,
        suggestedArgs,
      };
      problemData.problemType = detectProblemType(problemData);
      return problemData;
    } catch (error) {
      console.error('Error extracting LeetCode problem:', error);
      throw new Error('Failed to extract problem from LeetCode');
    }
  },

  cleanupText,
};

/**
 * Extractor for HackerRank problems
 */
const hackerrankExtractor = {
  /**
   * Extracts problem data from a HackerRank problem page
   * @returns {Object} - The extracted problem data
   */
  extractProblem() {
    try {
      const titleElement = queryFirst(['.challenge-title', 'h1[class*="challenge"]', 'h1']);
      const title = titleElement ? titleElement.textContent.trim() : '';

      const descriptionContainer = queryFirst(['.challenge-body-html', '.challenge-text', '[class*="problem-statement"]']) || document;
      const description = descriptionContainer.textContent ? cleanupText(descriptionContainer.textContent) : '';

      const examples = [];
      descriptionContainer.querySelectorAll('pre').forEach((block) => {
        examples.push(block.textContent.trim());
      });

      const constraints = extractConstraints(descriptionContainer);
      const difficultyMatch = document.body.textContent.match(/\b(Easy|Medium|Hard)\b/);

      const problemData = {
        title,
        description,
        examples,
        constraints,
        difficulty: difficultyMatch ? difficultyMatch[1] : '',
        tags: [],
        starterCode: '',
        suggestedArgs: examples.length ? parseExampleArgs(examples[0]) : null,
      };
      problemData.problemType = detectProblemType(problemData);
      return problemData;
    } catch (error) {
      console.error('Error extracting HackerRank problem:', error);
      throw new Error('Failed to extract problem from HackerRank');
    }
  },

  cleanupText,
};

/**
 * Shared constraint-scraping logic: finds a "Constraints:" paragraph and
 * collects any list items that immediately follow it.
 */
function extractConstraints(container) {
  const constraints = [];
  const paragraphs = container.querySelectorAll('p, li');
  for (const p of paragraphs) {
    const text = p.textContent.trim();
    if (/constraints:/i.test(text)) {
      constraints.push(text);
      let nextElement = p.nextElementSibling;
      while (nextElement && (nextElement.tagName === 'UL' || nextElement.tagName === 'LI')) {
        if (nextElement.tagName === 'UL') {
          nextElement.querySelectorAll('li').forEach((item) => constraints.push(item.textContent.trim()));
        } else {
          constraints.push(nextElement.textContent.trim());
        }
        nextElement = nextElement.nextElementSibling;
      }
      break;
    }
  }
  return constraints;
}

// Export extractors
window.LeetVision = window.LeetVision || {};
window.LeetVision.extractors = {
  getExtractor,
};
