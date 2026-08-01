import { EXAMPLES, type Example } from '../examples/examples';
import type { Language } from '../engine/types';

interface Props {
  language: Language;
  currentId: string | null;
  onSelect: (example: Example) => void;
}

export function ExamplePicker({ language, currentId, onSelect }: Props) {
  const forLanguage = EXAMPLES.filter((e) => e.language === language);
  const categories = [...new Set(forLanguage.map((e) => e.category))];

  return (
    <select
      className="example-picker"
      value={currentId ?? ''}
      onChange={(e) => {
        const example = EXAMPLES.find((ex) => ex.id === e.target.value);
        if (example) onSelect(example);
      }}
    >
      <option value="" disabled>
        Load an example…
      </option>
      {categories.map((category) => (
        <optgroup key={category} label={category}>
          {forLanguage
            .filter((e) => e.category === category)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
