import type { Language } from '../engine/types';
import type { Theme } from '../lib/theme';

interface Props {
  language: Language;
  theme: Theme;
  shareLabel: string;
  onLanguageChange: (language: Language) => void;
  onToggleTheme: () => void;
  onShare: () => void;
}

export function Header({ language, theme, shareLabel, onLanguageChange, onToggleTheme, onShare }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden>◐</span>
        <div>
          <h1 className="brand-name">Algoscope</h1>
          <p className="brand-tag">Watch your code run</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="lang-toggle" role="tablist" aria-label="Language">
          <button
            role="tab"
            aria-selected={language === 'javascript'}
            className={`lang-btn ${language === 'javascript' ? 'active' : ''}`}
            onClick={() => onLanguageChange('javascript')}
          >
            JavaScript
          </button>
          <button
            role="tab"
            aria-selected={language === 'python'}
            className={`lang-btn ${language === 'python' ? 'active' : ''}`}
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
