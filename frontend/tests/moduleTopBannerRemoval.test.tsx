import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CompanySelectPage } from '../src/pages/CompanySelectPage'
import { DocumentSummaryPage } from '../src/pages/DocumentSummaryPage'
import { DocEditorPage } from '../src/pages/DocEditorPage'
import { TopicComposePage } from '../src/pages/TopicComposePage'
import { TopicDetailPage } from '../src/pages/TopicDetailPage'
import { TopicLibraryPage } from '../src/pages/TopicLibraryPage'
import { TopicListPage } from '../src/pages/TopicListPage'

describe('top-level module pages', () => {
  it('does not render the shared top banner on the summary page', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).not.toContain('class="page-header"')
  })

  it('does not render the shared top banner on the management company home', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/companies']}>
        <CompanySelectPage mode="management" />
      </MemoryRouter>,
    )

    expect(html).not.toContain('class="page-header"')
  })

  it('does not render the shared top banner on the layout module landing page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/companies/company-1/topics']}>
        <Routes>
          <Route path="/layout/companies/:companyId/topics" element={<TopicListPage mode="layout" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).not.toContain('class="page-header"')
  })

  it('does not render the shared top banner on the company pages', () => {
    const layoutHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/company-home']}>
        <CompanySelectPage mode="layout" />
      </MemoryRouter>,
    )
    const managementHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/companies']}>
        <CompanySelectPage mode="management" />
      </MemoryRouter>,
    )

    expect(layoutHtml).not.toContain('class="page-header"')
    expect(managementHtml).not.toContain('class="page-header"')
  })

  it('does not render the shared top banner on the topic flow pages', () => {
    const topicListManagementHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/companies/company-1/topics']}>
        <Routes>
          <Route path="/management/companies/:companyId/topics" element={<TopicListPage mode="management" />} />
        </Routes>
      </MemoryRouter>,
    )
    const topicComposeHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/topics/topic-1']}>
        <Routes>
          <Route path="/layout/topics/:topicId" element={<TopicComposePage />} />
        </Routes>
      </MemoryRouter>,
    )
    const topicDetailHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/topics/topic-1/train']}>
        <Routes>
          <Route path="/management/topics/:topicId/train" element={<TopicDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const topicLibraryHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/topics/topic-1/library']}>
        <Routes>
          <Route path="/layout/topics/:topicId/library" element={<TopicLibraryPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(topicListManagementHtml).not.toContain('class="page-header"')
    expect(topicComposeHtml).not.toContain('class="page-header"')
    expect(topicDetailHtml).not.toContain('class="page-header"')
    expect(topicLibraryHtml).not.toContain('class="page-header"')
  })

  it('does not render the shared top banner on the doc editor page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/docs/doc-1']}>
        <Routes>
          <Route path="/layout/docs/:id" element={<DocEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).not.toContain('class="page-header"')
  })
})
