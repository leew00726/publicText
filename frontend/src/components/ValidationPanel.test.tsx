import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ValidationPanel } from './ValidationPanel'

const issue = {
  code: 'BODY_FONT',
  type: 'A' as const,
  message: '正文字体不符合规范',
  path: 'body.content[0]',
  level: 'error' as const,
}

function renderPanel(status: 'idle' | 'running' | 'passed' | 'issues' | 'stale' | 'error') {
  return renderToStaticMarkup(
    <ValidationPanel
      issues={[issue]}
      status={status}
      errorMessage={status === 'error' ? '服务暂时不可用' : null}
      onCheck={vi.fn()}
      onOneClickLayout={vi.fn()}
      onLocate={vi.fn()}
    />,
  )
}

describe('ValidationPanel', () => {
  it('does not claim success before a validation has run', () => {
    const html = renderPanel('idle')
    expect(html).toContain('尚未校验')
    expect(html).not.toContain('当前无规范问题')
  })

  it('hides invalidated issue details after the document changes', () => {
    const html = renderPanel('stale')
    expect(html).toContain('上次校验结果已失效')
    expect(html).not.toContain(issue.message)
  })

  it('only claims a clean result for the passed state', () => {
    expect(renderPanel('passed')).toContain('已校验：当前无规范问题')
    expect(renderPanel('issues')).toContain('发现 1 项问题')
    expect(renderPanel('issues')).toContain(issue.message)
  })
})
