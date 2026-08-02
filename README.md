# Algoscope

**Watch your code run.** Algoscope executes **JavaScript and Python** one step at a time and turns each step into a live data-structure visualization — arrays, matrices, hash maps, sets, linked lists, trees, and graphs — so you can *see* an algorithm work instead of just reading it.

**[▶ Live demo](https://hemanthrayuduu.github.io/Algoscope/)**

<!-- ![Algoscope in action](docs/screenshot.png) -->

## Two modes

**Practice** — pick a problem, read the statement, and solve it. The example input is drawn before you write a line, your solution is visualized *as you type*, and Submit judges it against every test case with a per-case pass/fail breakdown and the first failing input.

**Playground** — free-form: write or load any snippet, set the arguments, and step through it.

## Features

- **Two languages, one experience.** JavaScript runs in a custom sandboxed interpreter; Python runs on real CPython (Pyodide/WebAssembly) in a Web Worker. Both feed the same visualizations and the same judge.
- **Live preview while typing** — a debounced run keeps the visualization in sync with your code. Half-written code keeps the last working visualization on screen instead of flashing errors, and a slow run can never overwrite a newer one.
- **Real step-through execution** — step forward/back, scrub the timeline, or play it, with the current line highlighted in the editor.
- **Automatic visualization** — values are classified and drawn for you: arrays as index-labeled cells (changed cells highlight), 2-D arrays as grids, `Map`/`dict` and `Set` as tables/chips, and `{val, next}` / `{val, left, right}` objects as linked lists, trees, and graphs. Call stack and in-scope variables shown alongside.
- **A judge that doesn't punish valid answers** — problems declare how results are compared (`exact`, `unordered`, `set`), so returning `[1,0]` where `[0,1]` was expected still passes when either is correct.
- **Worked examples** across hash maps, searching, sorting, DP, stacks, linked lists, trees, graphs, and sliding windows — each with a complexity note.
- **Shareable links** encode your exact code + input into a compressed URL.
- **Light / dark themes** and a responsive layout.

## Tech stack

| Area | Choice |
| --- | --- |
| App shell | React + TypeScript + Vite |
| Editor | CodeMirror 6 |
| JS execution | Custom `acorn`-based interpreter — **no `eval` / `new Function`** |
| Python execution | Pyodide (CPython → WebAssembly) traced with `sys.settrace`, in a Web Worker |
| Visualization | D3 |

## How it works

Running code produces an ordered list of **`Step`s** — each a serializable snapshot of one line (variables, call stack, stdout). Both backends normalize native values into one tagged model (`engine/types.ts`), so a single set of D3 renderers draws either language, and the judge can compare a JavaScript result with a Python one directly. JavaScript is walked as an acorn AST that yields a step per statement; Python is traced with `sys.settrace` and its objects (including `ListNode`/`TreeNode` instances) serialized into the same model. Pyodide is fetched from a CDN on first use.

Judging skips snapshot capture entirely — it only needs the return value, and tracing is the dominant cost — so submitting runs many test cases quickly while the visualization keeps its full step-by-step trace.

## Correctness

Two different questions, answered by two different mechanisms.

**Is a submitted solution correct?** It's run against every test case for that problem and the results are compared under the problem's comparison mode. Expected outputs aren't written by hand — they're produced by running that problem's reference solution, so adding a case only means adding an input.

**Is Algoscope itself correct?** The interpreter is a hand-written re-implementation of a JavaScript subset, so it's checked against the only oracle that counts — the real engine:

- **Differential tests** run each snippet through both the interpreter and native JavaScript and assert the results are identical. Any divergence is an interpreter bug.
- **A library self-check** asserts every reference solution passes its own test cases, that a starter stub fails, and that a correct-but-differently-ordered answer passes. A malformed problem fails CI instead of silently marking correct submissions wrong.
- **A cross-language check** (`npm run test:python`) runs every Python reference solution against real CPython and asserts both languages agree on all 42 cases.

These tests paid for themselves immediately, catching four real bugs: `let` in a `for` loop not creating a per-iteration binding (so closures captured the final value), the default `sort()` ordering numerically instead of lexicographically, missing support for `sort(comparator)`, and — worst — `while (true) {}` hanging the tab, because the step limit only counted yielded steps and an empty loop body yields none. All four are fixed and covered by tests.

## Development

```bash
npm install
npm run dev          # dev server
npm run build        # type-check + production build to dist/
npm run preview      # preview the build
npm test             # unit + differential tests
npm run test:python  # cross-language reference check (requires python3)
```

A modern browser (WebAssembly + module workers) is required for the Python runtime.

## Language support

- **Python:** full CPython via Pyodide (standard library; no runtime pip installs).
- **JavaScript:** a practical subset — variables/destructuring, all common control flow, functions/arrows/recursion, arrays, objects, `Map`, `Set`, template literals, and the usual `Array`/`String`/`Map`/`Set`/`Math`/`Object`/`JSON` methods. Unsupported on purpose (`async`/`await`, classes, `try`/`catch`, regex, custom `sort` comparators) raise a clear error instead of failing silently.

## License

MIT
