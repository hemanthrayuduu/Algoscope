import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { OutputPanel } from './components/OutputPanel';
import { ItemPanel } from './components/ItemPanel';
import { LibraryPicker } from './components/LibraryPicker';
import { LibraryBrowser } from './components/LibraryBrowser';
import { ResultsPanel } from './components/ResultsPanel';
import { ExampleViz } from './components/ExampleViz';
import { run } from './engine/runner';
import { judge, type JudgeReport } from './judge/judge';
import type { Language, RunResult } from './engine/types';
import { DEFAULT_ITEM_ID, getItem, neighbours } from './library';
import { isJudgeable, type LibraryItem } from './library/types';
import { useLiveRun } from './hooks/useLiveRun';
import { applyTheme, getInitialTheme, type Theme } from './lib/theme';
import { buildShareUrl, readStateFromUrl } from './lib/share';

const SOLVED_KEY = 'algoscope-solved';

export function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [language, setLanguage] = useState<Language>('javascript');

  const [itemId, setItemId] = useState(DEFAULT_ITEM_ID);
  const [code, setCode] = useState('');
  const [entryFunction, setEntryFunction] = useState('');
  const [argsJson, setArgsJson] = useState('[]');

  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [showingSolution, setShowingSolution] = useState(false);

  const [manualResult, setManualResult] = useState<RunResult | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [status, setStatus] = useState('');
  const [shareLabel, setShareLabel] = useState('Share');

  const item = useMemo(() => getItem(itemId), [itemId]);
  const step = useMemo(() => neighbours(itemId, language), [itemId, language]);
  const judgeable = isJudgeable(item);
  const judgeAbort = useRef<AbortController | null>(null);

  // The visualization follows the live run; an explicit Run press overrides it
  // until the next edit.
  const live = useLiveRun({
    code,
    language,
    entryFunction,
    argsJson,
    enabled: liveEnabled && !judging,
    resetKey: `${itemId}:${language}`,
  });

  const activeResult = manualResult ?? live.result;
  const steps = activeResult?.steps ?? [];
  const hasSteps = steps.length > 0;
  const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const prevStep = stepIndex - 1 >= 0 && stepIndex - 1 < steps.length ? steps[stepIndex - 1] : null;
  const atEnd = stepIndex >= steps.length - 1;

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    try {
      const stored = localStorage.getItem(SOLVED_KEY);
      if (stored) setSolvedIds(new Set(JSON.parse(stored)));
    } catch {
      // A corrupt entry shouldn't stop the app from loading.
    }

    const shared = readStateFromUrl();
    if (shared) {
      setLanguage(shared.language);
      setCode(shared.code);
      setEntryFunction(shared.entryFunction);
      setArgsJson(shared.argsJson);
      setItemId('scratch');
    } else {
      loadItem(getItem(DEFAULT_ITEM_ID), 'javascript');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  // A fresh live trace starts from the beginning.
  useEffect(() => {
    if (!manualResult && live.result) {
      setStepIndex(live.result.steps.length ? 0 : -1);
    }
  }, [live.result, manualResult]);

  // Keep the index inside the current trace. Without this the counter could
  // read "1 / 8" while the index was still -1, so it claimed to be showing a
  // step while the panel rendered nothing.
  useEffect(() => {
    if (steps.length === 0) {
      if (stepIndex !== -1) setStepIndex(-1);
    } else if (stepIndex < 0) {
      setStepIndex(0);
    } else if (stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [steps.length, stepIndex]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStepIndex((prev) => (prev >= steps.length - 1 ? prev : prev + 1));
    }, speed);
    return () => window.clearInterval(id);
  }, [playing, speed, steps.length]);

  useEffect(() => {
    if (playing && stepIndex >= steps.length - 1) setPlaying(false);
  }, [playing, stepIndex, steps.length]);

  function loadItem(next: LibraryItem, lang: Language = language) {
    const variant = next.languages[lang] ?? next.languages.javascript ?? next.languages.python;
    if (!variant) return;
    setItemId(next.id);
    setCode(variant.code);
    setEntryFunction(variant.entryFunction);
    setArgsJson(next.previewArgs);
    setShowingSolution(false);
    setManualResult(null);
    setReport(null);
    setStepIndex(-1);
    setPlaying(false);
    setStatus('');
  }

  /**
   * Loads the reference solution into the editor. A challenge otherwise starts
   * as an empty stub, which runs to nothing and makes the visualization look
   * broken to someone who hasn't written any code yet.
   */
  function showSolution() {
    const variant = item.languages[language];
    if (!variant?.referenceSolution) return;
    setCode(variant.referenceSolution);
    setShowingSolution(true);
    setManualResult(null);
    setReport(null);
    setPlaying(false);
  }

  /** Puts the starter stub back so the challenge can be attempted. */
  function resetToStarter() {
    const variant = item.languages[language];
    if (!variant) return;
    setCode(variant.code);
    setShowingSolution(false);
    setManualResult(null);
    setReport(null);
    setPlaying(false);
  }

  function handleLanguageChange(next: Language) {
    if (next === language) return;
    setLanguage(next);
    // Keep the same item where possible; fall back to the default if this one
    // isn't written in the new language.
    const target = item.languages[next] ? item : getItem(DEFAULT_ITEM_ID);
    loadItem(target, next);
  }

  /** Explicit run: trace the current code on the current arguments. */
  const handleRun = useCallback(async () => {
    setRunning(true);
    setPlaying(false);
    setManualResult(null);
    setStepIndex(-1);
    setStatus('Preparing…');
    const result = await run(
      { code, language, entryFunction: entryFunction.trim(), argsJson },
      { onStatus: setStatus },
    );
    if (result) {
      setManualResult(result);
      setStepIndex(result.steps.length ? 0 : -1);
    }
    setRunning(false);
    setStatus('');
  }, [code, language, entryFunction, argsJson]);

  /** Submit: run every test case and report pass/fail. */
  const handleSubmit = useCallback(async () => {
    judgeAbort.current?.abort();
    const controller = new AbortController();
    judgeAbort.current = controller;

    setJudging(true);
    setReport(null);
    setStatus(language === 'python' ? 'Running test cases (Python)…' : 'Running test cases…');

    const result = await judge(item, code, language, controller.signal);
    if (result) {
      setReport(result);
      if (result.allPassed) {
        setSolvedIds((prev) => {
          const next = new Set(prev).add(item.id);
          try {
            localStorage.setItem(SOLVED_KEY, JSON.stringify([...next]));
          } catch {
            // Storage can be unavailable in private browsing; not fatal.
          }
          return next;
        });
      }
    }
    setJudging(false);
    setStatus('');
  }, [item, code, language]);

  function handleShare() {
    buildShareUrl({ code, language, entryFunction, argsJson });
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setShareLabel('Copied!');
        window.setTimeout(() => setShareLabel('Share'), 1500);
      },
      () => setShareLabel('Link in URL'),
    );
  }

  return (
    <div className="app">
      <Header
        language={language}
        theme={theme}
        shareLabel={shareLabel}
        onLanguageChange={handleLanguageChange}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onShare={handleShare}
      />

      <main className="workspace">
        <section className="pane pane-item">
          <div className="toolbar toolbar-stacked">
            <button className="btn btn-primary browse-btn" onClick={() => setBrowserOpen(true)}>
              ☰ Browse library
            </button>
            <div className="switcher">
              <button
                className="btn switcher-step"
                onClick={() => step.prev && loadItem(step.prev)}
                disabled={!step.prev}
                title="Previous item"
              >
                ‹
              </button>
              <LibraryPicker
                currentId={itemId}
                language={language}
                solvedIds={solvedIds}
                onSelect={(next) => loadItem(next)}
              />
              <button
                className="btn switcher-step"
                onClick={() => step.next && loadItem(step.next)}
                disabled={!step.next}
                title="Next item"
              >
                ›
              </button>
            </div>
          </div>
          <div className="item-scroll">
            <ItemPanel item={item} />
          </div>
        </section>

        <section className="pane pane-code">
          <div className="toolbar">
            <div className="field field-grow">
              <label>Arguments (JSON array)</label>
              <input
                className="text-input"
                value={argsJson}
                onChange={(e) => setArgsJson(e.target.value)}
                spellCheck={false}
              />
            </div>
            {item.kind === 'scratch' && (
              <div className="field">
                <label>Run function</label>
                <input
                  className="text-input"
                  value={entryFunction}
                  onChange={(e) => setEntryFunction(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" checked={liveEnabled} onChange={(e) => setLiveEnabled(e.target.checked)} />
              Live
            </label>
            {judgeable && (
              <button
                className="btn"
                onClick={showingSolution ? resetToStarter : showSolution}
                title={
                  showingSolution
                    ? 'Restore the starter code'
                    : 'Load a working solution so you can watch it run'
                }
              >
                {showingSolution ? '↩ Starter' : '👁 Solution'}
              </button>
            )}
            {judgeable && (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={judging}>
                {judging ? 'Judging…' : 'Submit'}
              </button>
            )}
          </div>

          <div className="editor-wrap">
            <CodeEditor
              value={code}
              language={language}
              theme={theme}
              activeLine={currentStep?.line ?? null}
              onChange={(next) => {
                setCode(next);
                // Typing invalidates an explicit run; live preview takes over.
                if (manualResult) {
                  setManualResult(null);
                  setPlaying(false);
                }
              }}
            />
          </div>

          {judgeable && <ResultsPanel report={report} running={judging} status={status} />}

          <Controls
            hasSteps={hasSteps}
            running={running}
            playing={playing}
            atStart={stepIndex <= 0}
            atEnd={atEnd}
            current={Math.max(stepIndex, 0)}
            total={steps.length}
            speed={speed}
            onRun={handleRun}
            onStepBack={() => setStepIndex((i) => Math.max(0, i - 1))}
            onStepForward={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            onPlayPause={() => {
              if (!hasSteps) return;
              if (atEnd) {
                setStepIndex(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            onReset={() => {
              setPlaying(false);
              setStepIndex(0);
            }}
            onScrub={(i) => {
              setPlaying(false);
              setStepIndex(i);
            }}
            onSpeed={setSpeed}
          />
        </section>

        <section className="pane pane-viz">
          <div className="viz-status-bar">
            {live.running && <span className="live-chip running">Running…</span>}
            {!live.running && live.staleReason && (
              <span className="live-chip stale" title={live.staleReason}>
                Showing last working run
              </span>
            )}
            {!live.running && !live.staleReason && hasSteps && <span className="live-chip ok">Live</span>}
          </div>

          <div className="viz-scroll">
            {hasSteps ? (
              <Visualizer step={currentStep} prevStep={prevStep} />
            ) : (
              <>
                <ExampleViz item={item} language={language} argsJson={argsJson} />
                {/* A failure with nothing retained is a real problem — a broken
                    runtime, not code mid-edit — so say what happened rather
                    than leaving it to a tooltip. */}
                {live.staleReason && (
                  <p className="viz-error">
                    <strong>Couldn’t run this.</strong> {live.staleReason}
                    {language === 'python' && ' Python runs on Pyodide, which is downloaded on first use — check your connection if this persists.'}
                  </p>
                )}
                {!live.staleReason && judgeable && !showingSolution && (
                  <p className="viz-cta">
                    Nothing to trace yet — the starter code is empty. Write a solution and it will animate as
                    you type, or press <strong>👁 Solution</strong> to watch a working one run.
                  </p>
                )}
              </>
            )}
          </div>

          <OutputPanel result={activeResult} step={currentStep} status={running ? status : ''} />
        </section>
      </main>

      <LibraryBrowser
        open={browserOpen}
        language={language}
        currentId={itemId}
        solvedIds={solvedIds}
        onSelect={(next) => {
          loadItem(next);
          setBrowserOpen(false);
        }}
        onClose={() => setBrowserOpen(false)}
      />
    </div>
  );
}
