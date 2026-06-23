import fs from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TopicLibraryPage } from './TopicLibraryPage'

describe('TopicLibraryPage', () => {
  it('offers DOCX upload inside the topic document library', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/topics/topic-1/library']}>
        <Routes>
          <Route path="/layout/topics/:topicId/library" element={<TopicLibraryPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const source = fs.readFileSync(path.resolve(__dirname, './TopicLibraryPage.tsx'), 'utf8')

    expect(html).toContain('上传文件')
    expect(html).toContain('accept=".docx')
    expect(source).toContain('/api/management/topics/${topicId}/docs/importDocx')
    expect(source).toContain('仅支持 DOCX 文件')
    expect(source).toContain('上传成功')
  })
})
