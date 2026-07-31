import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  acquireTemplateOperation,
  DraftConfirmationButton,
  formatRefreshFailureFeedback,
  OperationProgress,
  resolveInstructionAfterRevision,
  TemplateVersionSummary,
  TopicDetailPage,
} from './TopicDetailPage'

describe('TopicDetailPage revision actions', () => {
  it('shows an explicit submit button for revision instructions', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/topics/topic-1/train']}>
        <Routes>
          <Route path="/management/topics/:topicId/train" element={<TopicDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).toContain('推荐：直接生成首版模板草稿')
    expect(html).toContain('生成首版模板草稿')
    expect(html).toContain('maxLength="500"')
    expect(html).toContain('无需先上传文件')
    expect(html).toContain('补充：从样本提取规则')
    expect(html).toContain('1）上传并分析训练材料（可选）')
    expect(html).toContain('尚未生成模板草稿')
    expect(html).toContain('尚无生效模板')
    expect(html).toContain('最新模板草稿')
    expect(html).toContain('已确认模板版本')
    expect(html).toContain('aria-busy="false"')
    expect(html).not.toContain('正文字体（可选）')
    expect(html).not.toContain('清空对话')
    expect(html).not.toContain('训练材料删除审计')
  })

  it('distinguishes the draft version from the effective template version', () => {
    const html = renderToStaticMarkup(<TemplateVersionSummary draftVersion={4} effectiveTemplateVersion={3} />)

    expect(html).toContain('草稿版本 v4')
    expect(html).toContain('生效模板版本 v3')
    expect(html).not.toContain('当前草稿 v4')
  })

  it('disables confirmation after the current draft has been confirmed', () => {
    const html = renderToStaticMarkup(
      <DraftConfirmationButton
        draftStatus="confirmed"
        confirming={false}
        progressId="template-confirmation-progress"
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('当前草稿已确认')
    expect(html).not.toContain('确认当前草稿并保存模板')
  })

  it('announces elapsed time for long-running template operations', () => {
    const html = renderToStaticMarkup(
      <OperationProgress id="template-revision-progress" label="模板草稿修订进行中" elapsedSeconds={12} />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toContain('模板草稿修订进行中，已等待 12 秒，请稍候。')
  })

  it('shows the pending confirmation state while the request is running', () => {
    const html = renderToStaticMarkup(
      <DraftConfirmationButton
        draftStatus="draft"
        confirming={true}
        progressId="template-confirmation-progress"
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-describedby="template-confirmation-progress"')
    expect(html).toContain('正在确认当前草稿…')
  })

  it('preserves a new instruction typed while the previous revision is pending', () => {
    expect(resolveInstructionAfterRevision('第二条修订指令', '第一条修订指令')).toBe('第二条修订指令')
    expect(resolveInstructionAfterRevision('第一条修订指令', '第一条修订指令')).toBe('')
  })

  it('allows only one template operation to acquire the shared lock', () => {
    const firstAttempt = acquireTemplateOperation(null, 'revise')
    expect(firstAttempt).toEqual({ acquired: true, activeOperation: 'revise' })

    const overlappingAttempt = acquireTemplateOperation(firstAttempt.activeOperation, 'confirm')
    expect(overlappingAttempt).toEqual({ acquired: false, activeOperation: 'revise' })
  })

  it('disables confirmation while a different template operation owns the lock', () => {
    const html = renderToStaticMarkup(
      <DraftConfirmationButton
        draftStatus="draft"
        confirming={false}
        operationBusy={true}
        progressId="template-confirmation-progress"
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('确认当前草稿并保存模板')
  })

  it('reports refresh failure without misreporting the completed operation', () => {
    const feedback = formatRefreshFailureFeedback('草稿版本 v4 已确认。', '网络连接中断。')

    expect(feedback).toContain('操作已成功：草稿版本 v4 已确认。')
    expect(feedback).toContain('但页面数据刷新失败：网络连接中断。')
    expect(feedback).not.toContain('确认草稿失败')
  })
})
