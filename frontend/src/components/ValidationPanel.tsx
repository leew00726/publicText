import type { CheckIssue } from '../api/types'

interface Props {
  issues: CheckIssue[]
  onCheck: () => void
  onOneClickLayout: () => void
  onLocate: (path: string) => void
}

export function ValidationPanel({ issues, onCheck, onOneClickLayout, onLocate }: Props) {
  return (
    <div className="panel validation-panel">
      <div className="row-between">
        <h3>规范校验</h3>
        <button type="button" onClick={onCheck}>
          重新校验
        </button>
      </div>

      <button type="button" className="full-btn" onClick={onOneClickLayout}>
        一键排版
      </button>

      <div className="issues">
        {issues.length === 0 ? (
          <p>当前无校验问题。</p>
        ) : (
          issues.map((issue, idx) => (
            <button key={`${issue.code}-${idx}`} type="button" className={`issue ${issue.level}`} onClick={() => onLocate(issue.path)}>
              <strong>[{issue.type}]</strong> {issue.message}
              <small>{issue.path}</small>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
