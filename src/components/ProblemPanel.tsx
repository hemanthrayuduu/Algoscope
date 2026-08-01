import type { Problem } from '../problems/types';

interface Props {
  problem: Problem;
}

export function ProblemPanel({ problem }: Props) {
  return (
    <div className="problem-panel">
      <div className="problem-heading">
        <h2 className="problem-title">{problem.title}</h2>
        <span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
      </div>

      <div className="topic-row">
        {problem.topics.map((topic) => (
          <span key={topic} className="badge">
            {topic}
          </span>
        ))}
      </div>

      {problem.description.split('\n\n').map((paragraph, i) => (
        <p key={i} className="problem-text">
          {paragraph}
        </p>
      ))}

      <h3 className="problem-subhead">Examples</h3>
      {problem.examples.map((example, i) => (
        <div key={i} className="example-card">
          <div className="example-row">
            <span className="example-key">Input</span>
            <code>{example.inputLabel}</code>
          </div>
          <div className="example-row">
            <span className="example-key">Output</span>
            <code>{example.outputLabel}</code>
          </div>
          {example.explanation && <p className="example-explanation">{example.explanation}</p>}
        </div>
      ))}

      <h3 className="problem-subhead">Constraints</h3>
      <ul className="constraint-list">
        {problem.constraints.map((constraint, i) => (
          <li key={i}>
            <code>{constraint}</code>
          </li>
        ))}
      </ul>

      <h3 className="problem-subhead">Target complexity</h3>
      <p className="problem-text complexity-line">
        Time <strong>{problem.timeComplexity}</strong> · Space <strong>{problem.spaceComplexity}</strong>
      </p>
    </div>
  );
}
