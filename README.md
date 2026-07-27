# LeetVision

A Chrome extension that visualizes coding problems from platforms like LeetCode and HackerRank using interactive D3.js visualizations.

## Features

- Detects when a user is viewing a coding problem on supported platforms
- Extracts problem statements, examples, constraints, difficulty, tags, and (when visible) starter code
- Analyzes problems using an LLM and renders the result as an interactive D3.js visualization
- **Step-through solution visualizer**: paste your own JS solution and watch it execute one statement at a time, with arrays, hash maps/sets, and linked-list/tree-shaped objects rendered live as D3 graphics. This runs entirely locally in the content script — no API key, no network call, and no `eval`/`Function` (see [Architecture](#architecture) below).
- Play / pause / step / reset controls and adjustable playback speed for the step-through view

## Core Components

1. **Problem Extraction** (`src/content/extractors.js`) — scrapes problem details from supported platforms, with resilient fallback selectors since these sites don't offer a stable public API and change their markup often
2. **LLM Integration** (`src/background/background.js`) — analyzes problems and generates D3.js visualization code
3. **Sandboxed JS Interpreter** (`src/interpreter/interpreter.js`) — a small tree-walking, generator-based interpreter (built on [acorn](https://github.com/acornjs/acorn) for parsing) that executes user-submitted solutions statement-by-statement and yields a serializable snapshot after each one
4. **D3.js Visualizations** (`src/content/visualization.js`, `src/content/stepRenderer.js`) — renders both the LLM-generated visualization and the live step-through state
5. **User Interface** (`src/content/stepVisualizer.js`, `src/popup/`) — the floating in-page panel and extension popup

## Supported Platforms

- LeetCode
- HackerRank

## Supported Problem Types

Problem-type detection (used to pick sensible defaults) currently recognizes: arrays, strings, linked lists, trees, graphs, matrices/grids, stacks, queues, heaps, hash maps, and dynamic programming — based on a heuristic over the title/description/tags text.

The step-through interpreter supports a practical subset of JavaScript: variable declarations (incl. array/object destructuring), `if`/`for`/`while`/`do-while`/`for-of`/`for-in`, functions and recursion, arrays, plain objects, `Map`/`Set`, template literals, and common `Array`/`String`/`Map`/`Set`/`Math` methods. It intentionally does not support `async`/`await`, classes, `try`/`catch`, or custom sort comparators — these throw a clear "unsupported" error rather than failing silently.

## Architecture

The step-through visualizer deliberately avoids `eval()`/`new Function()` anywhere in its execution path. Instead of running user code natively, it parses it into an AST and walks the AST itself as a JS generator, yielding a snapshot of scope state after every statement. This has two benefits: it works cleanly under Manifest V3's content-script CSP (which disallows `unsafe-eval`), and the generator's own step boundaries double as the play/pause/step timeline for the UI — no separate instrumentation pass or worker/message-passing bridge is needed.

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

Then load the `dist/` folder as an unpacked extension via `chrome://extensions`.

## Acknowledgments

The step-through visualizer feature was inspired by [nyaomaru/dsa-view-view](https://github.com/nyaomaru/dsa-view-view), which animates TypeScript DSA functions step by step using React, Vite, Monaco, and Web Worker-sandboxed execution. LeetVision's version is a from-scratch implementation built for a different context (a Manifest V3 Chrome extension attached directly to LeetCode/HackerRank problem pages, using a custom non-`eval` interpreter instead of a Worker + Babel pipeline), but the core idea of visualizing a running algorithm's state step by step is credited to that project.

## License

MIT
