import { useEffect, useMemo, useRef, useState } from 'react';
import { groupItems, searchLibrary } from '../library';
import type { LibraryItem } from '../library/types';
import type { Language } from '../engine/types';

interface Props {
  open: boolean;
  language: Language;
  currentId: string;
  solvedIds: Set<string>;
  onSelect: (item: LibraryItem) => void;
  onClose: () => void;
}

/**
 * Full list of everything in the library, as an overlay.
 *
 * The inline dropdown alone proved too easy to miss — it sat directly above a
 * heading showing the same title, so it read as a label rather than a control.
 * This gives switching an unmistakable, browsable home with search.
 */
export function LibraryBrowser({ open, language, currentId, solvedIds, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => groupItems(searchLibrary(query, language)), [query, language]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Reset the query each time it opens, and focus the search box so typing
  // works immediately.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Enter picks the only remaining match, so search-then-enter works.
      if (e.key === 'Enter' && flat.length === 1) onSelect(flat[0]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="browser-backdrop" onClick={onClose} role="presentation">
      <div
        className="browser"
        role="dialog"
        aria-modal="true"
        aria-label="Library"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="browser-head">
          <input
            ref={searchRef}
            className="browser-search"
            placeholder="Search by name, topic or difficulty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          <button className="btn btn-ghost browser-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="browser-body">
          {groups.length === 0 && <p className="browser-empty">Nothing matches “{query}”.</p>}

          {groups.map((group) => (
            <section key={group.label} className="browser-group">
              <h3 className="browser-group-label">{group.label}</h3>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`browser-row ${item.id === currentId ? 'current' : ''}`}
                  onClick={() => onSelect(item)}
                >
                  <span className="browser-row-main">
                    <span className="browser-row-title">
                      {solvedIds.has(item.id) && <span className="solved-tick">✓</span>}
                      {item.title}
                    </span>
                    <span className="browser-row-desc">{item.description.split('\n')[0]}</span>
                  </span>
                  <span className="browser-row-meta">
                    {item.difficulty && (
                      <span className={`difficulty difficulty-${item.difficulty.toLowerCase()}`}>
                        {item.difficulty}
                      </span>
                    )}
                    {item.topics.slice(0, 2).map((topic) => (
                      <span key={topic} className="badge">
                        {topic}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>

        <div className="browser-foot">
          {flat.length} of {searchLibrary('', language).length} shown · Esc to close
        </div>
      </div>
    </div>
  );
}
