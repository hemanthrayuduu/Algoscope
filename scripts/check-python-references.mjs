// Cross-language check for the library.
//
// The Vitest suite covers the JavaScript reference solutions, but Python runs
// on Pyodide in the browser and isn't available there. This script closes that
// gap: it runs every Python reference solution against the same test inputs
// using the same tracer module the app ships, then asserts the results agree
// with the JavaScript reference solutions.
//
// That catches two classes of bug the unit tests can't see: a broken Python
// reference, and the two languages quietly disagreeing on an answer.
//
// Usage: node scripts/check-python-references.mjs   (requires python3)

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Kept inside the project (not the OS temp dir) so the transpiled modules can
// still resolve dependencies like acorn from node_modules.
const workDir = join(root, 'node_modules', '.algoscope-check');
rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

/** Transpiles a TS module and imports it, rewriting relative specifiers. */
async function loadModule(relPath, rewrites = {}) {
  const source = readFileSync(join(root, relPath), 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(rewrites)) {
    js = js.split(`'${from}'`).join(`'${to}'`);
  }
  const outPath = join(workDir, relPath.replace(/[\\/]/g, '_').replace(/\.ts$/, '.mjs'));
  writeFileSync(outPath, js);
  return import(outPath);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

const { CHALLENGES } = await loadModule('src/library/challenges.ts', { './types': './types.mjs' });
const { DEMOS } = await loadModule('src/library/demos.ts', { './types': './types.mjs' });
const { runJavaScript } = await loadModule('src/engine/jsInterpreter.ts', { './types': './types.mjs' });
const { resultsMatch, formatValue } = await loadModule('src/judge/compare.ts', {
  '../library/types': './types.mjs',
});
const { TRACER_SOURCE } = await loadModule('src/engine/python/tracer.ts');

const tracerPath = join(workDir, 'tracer.py');
writeFileSync(tracerPath, TRACER_SOURCE);

/** Runs one Python solution through the shipped tracer, untraced. */
function runPython(code, entryFunction, args) {
  const driverPath = join(workDir, 'driver.py');
  const payloadPath = join(workDir, 'payload.json');
  writeFileSync(payloadPath, JSON.stringify({ code, entryFunction, args }));
  writeFileSync(
    driverPath,
    [
      'import json',
      `exec(open(${JSON.stringify(tracerPath)}).read())`,
      `payload = json.load(open(${JSON.stringify(payloadPath)}))`,
      'print(_run(payload["code"], payload["entryFunction"], json.dumps(payload["args"]), 100000, False))',
    ].join('\n'),
  );
  const stdout = execFileSync('python3', [driverPath], { encoding: 'utf8' });
  return JSON.parse(stdout.trim().split('\n').pop());
}

function runJs(code, entryFunction, args) {
  return runJavaScript(
    { code, language: 'javascript', entryFunction, argsJson: JSON.stringify(args) },
    { collectSteps: false },
  );
}

let checked = 0;

console.log(`Checking ${CHALLENGES.length} challenges against python3...\n`);

for (const item of CHALLENGES) {
  const normalize = item.normalize ?? ((v) => v);
  const js = item.languages.javascript;
  const py = item.languages.python;
  let itemOk = true;

  for (const testCase of item.testCases) {
    const label = JSON.stringify(testCase.args);

    const jsResult = runJs(js.referenceSolution, js.entryFunction, testCase.args);
    if (jsResult.error) {
      fail(`${item.id}: JS reference failed on ${label}: ${jsResult.error}`);
      itemOk = false;
      continue;
    }

    const pyResult = runPython(py.referenceSolution, py.entryFunction, testCase.args);
    if (pyResult.error) {
      fail(`${item.id}: Python reference failed on ${label}: ${pyResult.error}`);
      itemOk = false;
      continue;
    }

    const jsValue = normalize(jsResult.returnValue);
    const pyValue = normalize(pyResult.returnValue);
    if (!resultsMatch(pyValue, jsValue, item.compare)) {
      fail(
        `${item.id}: languages disagree on ${label}\n    JS:     ${formatValue(jsValue)}\n    Python: ${formatValue(pyValue)}`,
      );
      itemOk = false;
    }
    checked++;
  }

  if (itemOk) console.log(`  ✓ ${item.title} (${item.testCases.length} cases)`);
}

// Demos have no test cases, but both language versions still have to run and
// agree on their preview input — otherwise switching language silently shows
// something different.
console.log(`\nChecking ${DEMOS.length} demos...\n`);

for (const item of DEMOS) {
  const args = JSON.parse(item.previewArgs);
  const js = item.languages.javascript;
  const py = item.languages.python;

  const jsResult = runJs(js.code, js.entryFunction, args);
  if (jsResult.error) {
    fail(`${item.id}: JS demo failed: ${jsResult.error}`);
    continue;
  }

  const pyResult = runPython(py.code, py.entryFunction, args);
  if (pyResult.error) {
    fail(`${item.id}: Python demo failed: ${pyResult.error}`);
    continue;
  }

  if (!resultsMatch(pyResult.returnValue, jsResult.returnValue, 'exact')) {
    fail(
      `${item.id}: languages disagree\n    JS:     ${formatValue(jsResult.returnValue)}\n    Python: ${formatValue(pyResult.returnValue)}`,
    );
    continue;
  }
  checked++;
  console.log(`  ✓ ${item.title}`);
}

if (process.exitCode) {
  console.error('\nPython reference check FAILED');
} else {
  console.log(`\n✓ All ${checked} cases agree across JavaScript and Python`);
}
