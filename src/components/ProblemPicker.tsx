import { PROBLEMS } from '../problems/library';
import type { Problem } from '../problems/types';

interface Props {
  currentId: string;
  solvedIds: Set<string>;
  onSelect: (problem: Problem) => void;
}

export function ProblemPicker({ currentId, solvedIds, onSelect }: Props) {
  return (
    <select
      className="problem-picker"
      value={currentId}
      onChange={(e) => {
        const problem = PROBLEMS.find((p) => p.id === e.target.value);
        if (problem) onSelect(problem);
      }}
      aria-label="Choose a problem"
    >
      {PROBLEMS.map((problem) => (
        <option key={problem.id} value={problem.id}>
          {solvedIds.has(problem.id) ? '✓ ' : ''}
          {problem.title} · {problem.difficulty}
        </option>
      ))}
    </select>
  );
}
