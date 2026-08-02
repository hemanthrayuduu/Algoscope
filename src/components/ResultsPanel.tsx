import type { JudgeReport } from '../judge/judge';

interface Props {
  report: JudgeReport | null;
  running: boolean;
  status: string;
}

export function ResultsPanel({ report, running, status }: Props) {
  if (running) {
    return (
      <div className="results-panel">
        <div className="results-status">{status || 'Running test cases…'}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="results-panel">
        <div className="results-hint">Press Submit to run your solution against all test cases.</div>
      </div>
    );
  }

  if (report.fatalError) {
    return (
      <div className="results-panel">
        <div className="results-summary failed">Could not judge this submission</div>
        <pre className="results-error">{report.fatalError}</pre>
      </div>
    );
  }

  const firstFailure = report.results.find((r) => !r.passed);

  return (
    <div className="results-panel">
      <div className={`results-summary ${report.allPassed ? 'passed' : 'failed'}`}>
        {report.allPassed ? '✓ Accepted' : '✗ Wrong answer'} — {report.passed}/{report.total} test cases passed
      </div>

      <div className="case-dots">
        {report.results.map((result) => (
          <span
            key={result.index}
            className={`case-dot ${result.passed ? 'pass' : 'fail'}`}
            title={`Case ${result.index + 1}${result.hidden ? ' (hidden)' : ''}: ${result.passed ? 'passed' : 'failed'}`}
          >
            {result.passed ? '✓' : '✗'}
          </span>
        ))}
      </div>

      {firstFailure && (
        <div className="failure-detail">
          <div className="failure-title">
            First failing case ({firstFailure.hidden ? 'hidden test' : `case ${firstFailure.index + 1}`})
          </div>
          {firstFailure.hidden ? (
            <p className="results-hint">
              This case is hidden — its input isn't shown, but your solution returned the wrong result for it.
            </p>
          ) : (
            <table className="failure-table">
              <tbody>
                <tr>
                  <td>Input</td>
                  <td>
                    <code>{firstFailure.input}</code>
                  </td>
                </tr>
                <tr>
                  <td>Expected</td>
                  <td>
                    <code>{firstFailure.expected}</code>
                  </td>
                </tr>
                <tr>
                  <td>Got</td>
                  <td>
                    <code className={firstFailure.error ? 'error-text' : ''}>
                      {firstFailure.error ?? firstFailure.actual}
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {firstFailure.error && !firstFailure.hidden && <pre className="results-error">{firstFailure.error}</pre>}
        </div>
      )}
    </div>
  );
}
