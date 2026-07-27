# Algoscope

**Watch your code run.** Algoscope executes **JavaScript and Python** one step at a time and turns each step into a live data-structure visualization — arrays, matrices, hash maps, sets, linked lists, trees, and graphs — so you can *see* an algorithm work instead of just reading it.

**[▶ Live demo](https://hemanthrayuduu.github.io/Algoscope/)**

<!-- ![Algoscope in action](docs/screenshot.png) -->

## Features

- **Two languages, one experience.** JavaScript runs in a custom sandboxed interpreter; Python runs on real CPython (Pyodide/WebAssembly) in a Web Worker. Both feed the same visualizations.
- **Real step-through execution** — step forward/back, scrub the timeline, or play it, with the current line highlighted in the editor.
- **Automatic visualization** — values are classified and drawn for you: arrays as index-labeled cells (changed cells highlight), 2-D arrays as grids, `Map`/`dict` and `Set` as tables/chips, and `{val, next}` / `{val, left, right}` objects as linked lists, trees, and graphs. Call stack and in-scope variables shown alongside.
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

Running code produces an ordered list of **`Step`s** — each a serializable snapshot of one line (variables, call stack, stdout). Both backends normalize native values into one tagged model (`engine/types.ts`), so a single set of D3 renderers draws either language. JavaScript is walked as an acorn AST that yields a step per statement; Python is traced with `sys.settrace` and its objects (including `ListNode`/`TreeNode` instances) serialized into the same model. Pyodide is fetched from a CDN on first use.

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # type-check + production build to dist/
npm run preview   # preview the build
```

A modern browser (WebAssembly + module workers) is required for the Python runtime.

## Language support

- **Python:** full CPython via Pyodide (standard library; no runtime pip installs).
- **JavaScript:** a practical subset — variables/destructuring, all common control flow, functions/arrows/recursion, arrays, objects, `Map`, `Set`, template literals, and the usual `Array`/`String`/`Map`/`Set`/`Math`/`Object`/`JSON` methods. Unsupported on purpose (`async`/`await`, classes, `try`/`catch`, regex, custom `sort` comparators) raise a clear error instead of failing silently.

## License

MIT
