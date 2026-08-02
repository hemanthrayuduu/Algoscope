import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header, type AppMode } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { OutputPanel } from './components/OutputPanel';
import { ExamplePicker } from './components/ExamplePicker';
import { ProblemPanel } from './components/ProblemPanel';
import { ProblemPicker } from './components/ProblemPicker';
import { ResultsPanel } from './components/ResultsPanel';
import { ExampleViz } from './components/ExampleViz';
import { run } from './engine/runner';
import { judge, type JudgeReport } from './judge/judge';
import type { Language, RunResult } from './engine/types';
import { EXAMPLES, DEFAULT_EXAMPLE_ID, getExample, type Example } from './examples/examples';
import { DEFAULT_PROBLEM_ID, PROBLEMS, getProblem } from './problems/library';
import type { Problem } from './problems/types';
import { useLiveRun } from './hooks/useLiveRun';
import { applyTheme, getInitialTheme, type Theme } from './lib/theme';
import { buildShareUrl, readStateFromUrl } from './lib/share';

const SOLVED_KEY = 'algoscope-solved';

export function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [mode, setMode] = useState<AppMode>('practice');
  const [language, setLanguage] = useState<Language>('javascript');

  // Shared editor state across both modes.
  const [code, setCode] = useState('');
  const [entryFunction, setEntryFunction] = useState('');
  const [argsJson, setArgsJson] = useState('[]');

  // Practice mode.
  const [problemId, setProblemId] = useState(DEFAULT_PROBLEM_ID);
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [liveEnabled, setLiveEnabled] = useState(true);

  // Playground mode.
  const [exampleId, setExampleId] = useState<string | null>(null);

  const [manualResult, setManualResult] = useState<RunResult | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [status, setStatus] = useState('');
  const [shareLabel, setShareLabel] = useState('Share');

  const problem = useMemo(() => getProblem(problemId) ?? PROBLEMS[0], [problemId]);
  const judgeAbort = useRef<AbortController | null>(null);

  // In practice mode the visualization follows the live run; an explicit
  // Visualize press overrides it until the next edit.
  const live = useLiveRun({
    code,
    language,
    entryFunction,
    argsJson,
    enabled: mode === 'practice' && liveEnabled && !judging,
  });

  const activeResult = mode === 'practice' ? (manualResult ?? live.result) : manualResult;
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
      setMode('playground');
      setLanguage(shared.language);
      setCode(shared.code);
      setEntryFunction(shared.entryFunction);
      setArgsJson(shared.argsJson);
    } else {
      loadProblem(getProblem(DEFAULT_PROBLEM_ID)!, 'javascript');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  // When the live run produces a fresh trace, show it from the start.
  useEffect(() => {
    if (mode === 'practice' && !manualResult && live.result) {
      setStepIndex(live.result.steps.length ? 0 : -1);
    }
  }, [live.result, manualResult, mode]);

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

  function resetRunState() {
    setManualResult(null);
    setReport(null);
    setStepIndex(-1);
    setPlaying(false);
    setStatus('');
  }

  function loadProblem(next: Problem, lang: Language = language) {
    setProblemId(next.id);
    setCode(next.starterCode[lang]);
    setEntryFunction(next.entryFunction[lang]);
    setArgsJson(JSON.stringify(next.examples[0].args));
    resetRunState();
  }

  function loadExample(example: Example) {
    setLanguage(example.language);
    setCode(example.code);
    setEntryFunction(example.entryFunction);
    setArgsJson(example.argsJson);
    setExampleId(example.id);
    resetRunState();
  }

  function handleModeChange(next: AppMode) {
    if (next === mode) return;
    setMode(next);
    resetRunState();
    if (next === 'practice') {
      loadProblem(problem);
    } else {
      loadExample(getExample(exampleId ?? DEFAULT_EXAMPLE_ID));
    }
  }

  function handleLanguageChange(next: Language) {
    if (next === language) return;
    setLanguage(next);
    resetRunState();
    if (mode === 'practice') {
      loadProblem(problem, next);
    } else {
      const example = EXAMPLES.find((e) => e.language === next);
      if (example) loadExample(example);
    }
  }

  /** Explicit run: trace the current code on the current arguments. */
  const handleVisualize = useCallback(async () => {
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

    const result = await judge(problem, code, language, controller.signal);
    if (result) {
      setReport(result);
      if (result.allPassed) {
        setSolvedIds((prev) => {
          const next = new Set(prev).add(problem.id);
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
  }, [problem, code, language]);

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

  const currentExample = useMemo(() => (exampleId ? getExample(exampleId) : null), [exampleId]);
  const showingExampleShape = mode === 'practice' && !hasSteps;

  return (
    <div className="app">
      <Header
        mode={mode}
        language={language}
        theme={theme}
        shareLabel={shareLabel}
        onModeChange={handleModeChange}
        onLanguageChange={handleLanguageChange}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onShare={handleShare}
      />

      <main className={`workspace ${mode === 'practice' ? 'workspace-practice' : ''}`}>
        {mode === 'practice' && (
          <section className="pane pane-problem">
            <div className="toolbar">
              <ProblemPicker currentId={problemId} solvedIds={solvedIds} onSelect={(p) => loadProblem(p)} />
            </div>
            <div className="problem-scroll">
              <ProblemPanel problem={problem} />
            </div>
          </section>
        )}

        <section className="pane pane-code">
          <div className="toolbar">
            {mode === 'playground' ? (
              <>
                <ExamplePicker language={language} currentId={exampleId} onSelect={loadExample} />
                <div className="field">
                  <label>Run function</label>
                  <input
                    className="text-input"
                    value={entryFunction}
                    onChange={(e) => setEntryFunction(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="field field-grow">
                  <label>Arguments (JSON array)</label>
                  <input
                    className="text-input"
                    value={argsJson}
                    onChange={(e) => setArgsJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field field-grow">
                  <label>Preview input (JSON array)</label>
                  <input
                    className="text-input"
                    value={argsJson}
                    onChange={(e) => setArgsJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={liveEnabled} onChange={(e) => setLiveEnabled(e.target.checked)} />
                  Live preview
                </label>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={judging}>
                  {judging ? 'Judging…' : 'Submit'}
                </button>
              </>
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

          {mode === 'practice' && <ResultsPanel report={report} running={judging} status={status} />}

          <Controls
            hasSteps={hasSteps}
            running={running}
            playing={playing}
            atStart={stepIndex <= 0}
            atEnd={atEnd}
            current={Math.max(stepIndex, 0)}
            total={steps.length}
            speed={speed}
            onRun={handleVisualize}
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
          {mode === 'playground' && currentExample && (
            <div className="example-meta">
              <span className="badge">{currentExample.category}</span>
              <span className="complexity">
                Time <strong>{currentExample.time}</strong> · Space <strong>{currentExample.space}</strong>
              </span>
              <p className="example-desc">{currentExample.description}</p>
            </div>
          )}

          {mode === 'practice' && (
            <div className="viz-status-bar">
              {live.running && <span className="live-chip running">Running…</span>}
              {!live.running && live.staleReason && (
                <span className="live-chip stale" title={live.staleReason}>
                  Showing last working run
                </span>
              )}
              {!live.running && !live.staleReason && hasSteps && <span className="live-chip ok">Live</span>}
            </div>
          )}

          <div className="viz-scroll">
            {showingExampleShape ? (
              <ExampleViz problem={problem} language={language} exampleIndex={0} />
            ) : (
              <Visualizer step={currentStep} prevStep={prevStep} />
            )}
          </div>

          <OutputPanel result={activeResult} step={currentStep} status={running ? status : ''} />
        </section>
      </main>
    </div>
  );
}
