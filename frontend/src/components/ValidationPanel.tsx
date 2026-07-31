import type { CheckIssue } from '../api/types'

export type ValidationStatus = 'idle' | 'running' | 'passed' | 'issues' | 'stale' | 'error'

interface Props {
  issues: CheckIssue[]
  status: ValidationStatus
  errorMessage?: string | null
  editingDisabled?: boolean
  onCheck: () => void
  onOneClickLayout: () => void
  onLocate: (path: string) => void
}

export function ValidationPanel({ issues, status, errorMessage, editingDisabled = false, onCheck, onOneClickLayout, onLocate }: Props) {
  const showIssues = status === 'issues'

  return (
    <div className="panel validation-panel" aria-busy={status === 'running'}>
      <div className="row-between">
        <h3>规范校验</h3>
        <button type="button" onClick={onCheck} disabled={status === 'running' || editingDisabled}>
          {status === 'running' ? '校验中...' : status === 'idle' ? '开始校验' : '重新校验'}
        </button>
      </div>

      <button type="button" className="full-btn" onClick={onOneClickLayout} disabled={editingDisabled}>
        一键排版
      </button>

      <div className="issues">
        {status === 'idle' && <p className="validation-state idle" role="status">尚未校验。点击“开始校验”将先保存当前内容。</p>}
        {status === 'running' && <p className="validation-state running" role="status" aria-live="polite">正在保存并校验当前内容...</p>}
        {status === 'passed' && <p className="validation-state passed" role="status" aria-live="polite">已校验：当前无规范问题。</p>}
        {status === 'stale' && <p className="validation-state stale" role="status" aria-live="polite">内容已修改，上次校验结果已失效，请重新校验。</p>}
        {status === 'error' && <p className="validation-state error" role="alert">{errorMessage || '校验失败，请重试。'}</p>}
        {showIssues && (
          <>
            <p className="validation-state issues-found" role="status" aria-live="polite">已校验：发现 {issues.length} 项问题。</p>
            {issues.map((issue, idx) => (
              <button key={`${issue.code}-${idx}`} type="button" className={`issue ${issue.level}`} onClick={() => onLocate(issue.path)}>
                <strong>[{issue.type}]</strong> {issue.message}
                <small>{issue.path}</small>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
