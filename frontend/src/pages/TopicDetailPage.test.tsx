import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TopicDetailPage } from './TopicDetailPage'

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
    expect(html).not.toContain('正文字体（可选）')
    expect(html).not.toContain('清空对话')
    expect(html).not.toContain('训练材料删除审计')
  })
})
