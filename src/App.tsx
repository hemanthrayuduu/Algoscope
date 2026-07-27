import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { OutputPanel } from './components/OutputPanel';
import { ExamplePicker } from './components/ExamplePicker';
import { run } from './engine/runner';
import type { Language, RunResult } from './engine/types';
import { EXAMPLES, DEFAULT_EXAMPLE_ID, getExample, type Example } from './examples/examples';
import { applyTheme, getInitialTheme, type Theme } from './lib/theme';
import { buildShareUrl, readStateFromUrl } from './lib/share';

export function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState('');
  const [entryFunction, setEntryFunction] = useState('');
  const [argsJson, setArgsJson] = useState('[]');
  const [exampleId, setExampleId] = useState<string | null>(null);

  const [result, setResult] = useState<RunResult | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [status, setStatus] = useState('');
  const [shareLabel, setShareLabel] = useState('Share');

  // Initial load: a shared link wins; otherwise the default example.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const shared = readStateFromUrl();
    if (shared) {
      setLanguage(shared.language);
      setCode(shared.code);
      setEntryFunction(shared.entryFunction);
      setArgsJson(shared.argsJson);
      setExampleId(null);
    } else {
      loadExample(getExample(DEFAULT_EXAMPLE_ID));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  const steps = result?.steps ?? [];
  const hasSteps = steps.length > 0;
  const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const prevStep = stepIndex - 1 >= 0 && stepIndex - 1 < steps.length ? steps[stepIndex - 1] : null;
  const atStart = stepIndex <= 0;
  const atEnd = stepIndex >= steps.length - 1;

  // Auto-advance while playing.
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

  function loadExample(example: Example) {
    setLanguage(example.language);
    setCode(example.code);
    setEntryFunction(example.entryFunction);
    setArgsJson(example.argsJson);
    setExampleId(example.id);
    setResult(null);
    setStepIndex(-1);
    setPlaying(false);
    setStatus('');
  }

  const handleRun = useCallback(async () => {
    setRunning(true);
    setPlaying(false);
    setResult(null);
    setStepIndex(-1);
    setStatus('Preparing…');
    const res = await run(
      { code, language, entryFunction: entryFunction.trim(), argsJson },
      (message) => setStatus(message),
    );
    setResult(res);
    setStepIndex(res.steps.length ? 0 : -1);
    setRunning(false);
    setStatus('');
  }, [code, language, entryFunction, argsJson]);

  function handleLanguageChange(next: Language) {
    if (next === language) return;
    const example = EXAMPLES.find((e) => e.language === next);
    if (example) loadExample(example);
    else setLanguage(next);
  }

  function handlePlayPause() {
    if (!hasSteps) return;
    if (atEnd) {
      setStepIndex(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

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
        <section className="pane pane-code">
          <div className="toolbar">
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
          </div>

          <div className="editor-wrap">
            <CodeEditor
              value={code}
              language={language}
              theme={theme}
              activeLine={currentStep?.line ?? null}
              onChange={setCode}
            />
          </div>

          <Controls
            hasSteps={hasSteps}
            running={running}
            playing={playing}
            atStart={atStart}
            atEnd={atEnd}
            current={Math.max(stepIndex, 0)}
            total={steps.length}
            speed={speed}
            onRun={handleRun}
            onStepBack={() => setStepIndex((i) => Math.max(0, i - 1))}
            onStepForward={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            onPlayPause={handlePlayPause}
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
          {currentExample && (
            <div className="example-meta">
              <span className="badge">{currentExample.category}</span>
              <span className="complexity">
                Time <strong>{currentExample.time}</strong> · Space <strong>{currentExample.space}</strong>
              </span>
              <p className="example-desc">{currentExample.description}</p>
            </div>
          )}
          <div className="viz-scroll">
            <Visualizer step={currentStep} prevStep={prevStep} />
          </div>
          <OutputPanel result={result} step={currentStep} status={running ? status : ''} />
        </section>
      </main>
    </div>
  );
}
