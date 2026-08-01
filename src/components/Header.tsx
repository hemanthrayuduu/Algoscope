import type { Language } from '../engine/types';
import type { Theme } from '../lib/theme';

export type AppMode = 'practice' | 'playground';

interface Props {
  mode: AppMode;
  language: Language;
  theme: Theme;
  shareLabel: string;
  onModeChange: (mode: AppMode) => void;
  onLanguageChange: (language: Language) => void;
  onToggleTheme: () => void;
  onShare: () => void;
}

export function Header({
  mode,
  language,
  theme,
  shareLabel,
  onModeChange,
  onLanguageChange,
  onToggleTheme,
  onShare,
}: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ◐
        </span>
        <div>
          <h1 className="brand-name">Algoscope</h1>
          <p className="brand-tag">Watch your code run</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="segmented" role="tablist" aria-label="Mode">
          <button
            role="tab"
            aria-selected={mode === 'practice'}
            className={`segment ${mode === 'practice' ? 'active' : ''}`}
            onClick={() => onModeChange('practice')}
          >
            Practice
          </button>
          <button
            role="tab"
            aria-selected={mode === 'playground'}
            className={`segment ${mode === 'playground' ? 'active' : ''}`}
            onClick={() => onModeChange('playground')}
          >
            Playground
          </button>
        </div>

        <div className="segmented" role="tablist" aria-label="Language">
          <button
            role="tab"
            aria-selected={language === 'javascript'}
            className={`segment ${language === 'javascript' ? 'active' : ''}`}
            onClick={() => onLanguageChange('javascript')}
          >
            JavaScript
          </button>
          <button
            role="tab"
            aria-selected={language === 'python'}
            className={`segment ${language === 'python' ? 'active' : ''}`}
            onClick={() => onLanguageChange('python')}
          >
            Python
          </button>
        </div>

        <button className="btn btn-ghost" onClick={onShare} title="Copy a shareable link">
          🔗 {shareLabel}
        </button>
        <button className="btn btn-ghost" onClick={onToggleTheme} title="Toggle light / dark">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
