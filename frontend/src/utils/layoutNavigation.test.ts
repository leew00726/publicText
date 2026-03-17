import { describe, expect, it } from 'vitest'

import { LAYOUT_HOME_PATH, resolveLayoutBackPath } from './layoutNavigation'

describe('layoutNavigation', () => {
  it('uses the formal layout flow as the default entry path', () => {
    expect(LAYOUT_HOME_PATH).toBe('/layout/company-home')
  })

  it('returns to the workspace from the topic list because /layout no longer has a standalone landing page', () => {
    expect(resolveLayoutBackPath('/layout/companies/company-1/topics')).toBe('/workspace')
  })

  it('returns to the workspace from the employee company home entry page', () => {
    expect(resolveLayoutBackPath('/layout/company-home')).toBe('/workspace')
  })

  it('returns to the topic list from the topic compose page when the company is known', () => {
    expect(resolveLayoutBackPath('/layout/topics/topic-1', { topicCompanyId: 'company-1' })).toBe(
      '/layout/companies/company-1/topics',
    )
  })

  it('returns to the document library from the editor when the topic is known', () => {
    expect(resolveLayoutBackPath('/layout/docs/doc-1', { docTopicId: 'topic-1' })).toBe('/layout/topics/topic-1/library')
  })
})
