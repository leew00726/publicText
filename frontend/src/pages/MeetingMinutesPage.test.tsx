import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MeetingMinutesPage } from './MeetingMinutesPage'

describe('MeetingMinutesPage', () => {
  it('renders a front-end placeholder for the upcoming meeting minutes module', () => {
    const html = renderToStaticMarkup(<MeetingMinutesPage />)

    expect(html).toContain('会议纪要')
    expect(html).toContain('前端占位模块')
    expect(html).toContain('功能建设中')
    expect(html).toContain('当前仅开放界面占位')
  })
})
