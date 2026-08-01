interface Props {
  hasSteps: boolean;
  running: boolean;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  current: number;
  total: number;
  speed: number;
  onRun: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onPlayPause: () => void;
  onReset: () => void;
  onScrub: (index: number) => void;
  onSpeed: (ms: number) => void;
}

export function Controls(props: Props) {
  const {
    hasSteps, running, playing, atStart, atEnd, current, total, speed,
    onRun, onStepBack, onStepForward, onPlayPause, onReset, onScrub, onSpeed,
  } = props;

  return (
    <div className="controls">
      <button className="btn btn-primary" onClick={onRun} disabled={running}>
        {running ? 'Running…' : '▶ Run'}
      </button>
      <div className="controls-group">
        <button className="btn" onClick={onStepBack} disabled={!hasSteps || atStart} title="Step back">⏮</button>
        <button className="btn" onClick={onPlayPause} disabled={!hasSteps || atEnd} title="Play / pause">
          {playing ? '⏸' : '⏵'}
        </button>
        <button className="btn" onClick={onStepForward} disabled={!hasSteps || atEnd} title="Step forward">⏭</button>
        <button className="btn" onClick={onReset} disabled={!hasSteps} title="Reset to start">↺</button>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={current}
        disabled={!hasSteps}
        onChange={(e) => onScrub(Number(e.target.value))}
      />
      <span className="step-counter">{hasSteps ? `${current + 1} / ${total}` : '—'}</span>

      <label className="speed">
        Speed
        <input
          type="range"
          min={80}
          max={1200}
          step={20}
          // Invert so dragging right = faster.
          value={1280 - speed}
          onChange={(e) => onSpeed(1280 - Number(e.target.value))}
        />
      </label>
    </div>
  );
}
