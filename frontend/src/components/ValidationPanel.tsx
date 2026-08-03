import type { CheckIssue } from '../api/types'

interface Props {
  issues: CheckIssue[]
  status: 'idle' | 'checking' | 'valid' | 'invalid' | 'stale'
  onCheck: () => void
  onOneClickLayout: () => void
  onUndoLayout: () => void
  canUndoLayout: boolean
  onLocate: (path: string) => void
}

export function ValidationPanel({
  issues,
  status,
  onCheck,
  onOneClickLayout,
  onUndoLayout,
  canUndoLayout,
  onLocate,
}: Props) {
  const emptyStateText =
    status === 'idle'
      ? '尚未执行校验。'
      : status === 'stale'
        ? '内容已修改，请重新校验。'
        : status === 'checking'
          ? '正在校验当前内容...'
          : '当前无校验问题。'

  return (
    <div className="panel validation-panel">
      <div className="row-between">
        <h3>规范校验</h3>
        <button type="button" onClick={onCheck} disabled={status === 'checking'}>
          {status === 'checking' ? '校验中...' : status === 'idle' ? '开始校验' : '重新校验'}
        </button>
      </div>

      <button type="button" className="full-btn" onClick={onOneClickLayout}>
        一键排版
      </button>
      {canUndoLayout ? (
        <button type="button" className="full-btn secondary-button" onClick={onUndoLayout}>
          撤销一键排版
        </button>
      ) : null}

      <div className="issues">
        {issues.length === 0 ? (
          <p>{emptyStateText}</p>
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
