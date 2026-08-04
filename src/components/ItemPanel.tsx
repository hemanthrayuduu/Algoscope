import type { LibraryItem } from '../library/types';
import { isJudgeable } from '../library/types';

interface Props {
  item: LibraryItem;
}

/**
 * The context panel. Challenges get the full statement, constraints and worked
 * examples; demos and the scratchpad get a short explanation. The shape of the
 * panel is what tells you whether there's something to submit.
 */
export function ItemPanel({ item }: Props) {
  const judgeable = isJudgeable(item);

  return (
    <div className="item-panel">
      <div className="item-heading">
        <h2 className="item-title">{item.title}</h2>
        {item.difficulty && (
          <span className={`difficulty difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
        )}
      </div>

      {item.topics.length > 0 && (
        <div className="topic-row">
          {item.topics.map((topic) => (
            <span key={topic} className="badge">
              {topic}
            </span>
          ))}
        </div>
      )}

      {item.description.split('\n\n').map((paragraph, i) => (
        <p key={i} className="item-text">
          {paragraph}
        </p>
      ))}

      {item.examples && item.examples.length > 0 && (
        <>
          <h3 className="item-subhead">Examples</h3>
          {item.examples.map((example, i) => (
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
        </>
      )}

      {item.constraints && item.constraints.length > 0 && (
        <>
          <h3 className="item-subhead">Constraints</h3>
          <ul className="constraint-list">
            {item.constraints.map((constraint, i) => (
              <li key={i}>
                <code>{constraint}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      {(item.timeComplexity || item.spaceComplexity) && (
        <>
          <h3 className="item-subhead">{judgeable ? 'Target complexity' : 'Complexity'}</h3>
          <p className="item-text complexity-line">
            Time <strong>{item.timeComplexity}</strong> · Space <strong>{item.spaceComplexity}</strong>
          </p>
        </>
      )}

      {judgeable && (
        <p className="item-hint">
          {item.openWith === 'solution' && (
            <>
              Opens with a worked solution so you can watch it run — press <strong>↩ Starter</strong> to clear it
              and try the problem yourself.
              <br />
              <br />
            </>
          )}
          {item.testCases.length} test cases run when you submit, including edge cases and hidden ones.
        </p>
      )}
    </div>
  );
}
