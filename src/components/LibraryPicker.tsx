import { groupedFor } from '../library';
import type { LibraryItem } from '../library/types';
import type { Language } from '../engine/types';

interface Props {
  currentId: string;
  language: Language;
  solvedIds: Set<string>;
  onSelect: (item: LibraryItem) => void;
}

export function LibraryPicker({ currentId, language, solvedIds, onSelect }: Props) {
  const groups = groupedFor(language);

  return (
    <select
      className="library-picker"
      value={currentId}
      onChange={(e) => {
        const item = groups.flatMap((g) => g.items).find((i) => i.id === e.target.value);
        if (item) onSelect(item);
      }}
      aria-label="Choose what to run"
    >
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((item) => (
            <option key={item.id} value={item.id}>
              {solvedIds.has(item.id) ? '✓ ' : ''}
              {item.title}
              {item.difficulty ? ` · ${item.difficulty}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
