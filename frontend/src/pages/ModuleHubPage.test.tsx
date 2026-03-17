import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ModuleHubPage } from './ModuleHubPage'

vi.mock('../utils/employeeAuth', () => ({
  loadEmployeeSession: vi.fn(() => ({
    username: 'treter',
    role: 'admin',
    loginAt: '2026-03-12T00:00:00.000Z',
    companyName: '云成数科',
  })),
  listModulesByRole: vi.fn(() => [
    {
      key: 'summary',
      title: '公文总结',
      description: '聚焦内容提炼、要点归纳与主题提取，快速形成可复用摘要。',
      entryPath: '/summary',
      enabled: true,
    },
    {
      key: 'layout',
      title: '公文排版',
      description: '统一正文结构、格式规范和输出标准，提升发文一致性。',
      entryPath: '/layout',
      enabled: true,
    },
    {
      key: 'management',
      title: '公文管理',
      description: '管理公司、题材和历史文档，支持后续权限精细化治理。',
      entryPath: '/management',
      enabled: true,
    },
  ]),
}))

describe('ModuleHubPage', () => {
  it('renders the interactive 中国华能 hologram without restoring the removed workspace cards', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <ModuleHubPage />
      </MemoryRouter>,
    )

    expect(html).toContain('data-testid="module-h-hero"')
    expect(html).toContain('aria-label="中国华能全息投影主视觉"')
    expect(html).toContain('data-testid="module-h-canvas"')
    expect(html).toContain('data-particle-shape="中国华能"')
    expect(html).toContain('data-particle-style="tech-blue-cyan"')
    expect(html).toContain('data-particle-count-min="5000"')
    expect(html).toContain('data-background-style="deep-navy"')
    expect(html).toContain('data-effect-style="digital-stream"')
    expect(html).toContain('data-glow-mode="per-particle"')
    expect(html).toContain('data-wave-mode="energy-scanline"')
    expect(html).toContain('data-node-layout="structured-grid"')
    expect(html).toContain('中国华能')
    expect(html).toContain('class="module-h-scanlines"')
    expect(html).toContain('公文总结')
    expect(html).toContain('公文排版')
    expect(html).toContain('公文管理')

    expect(html).not.toContain('全息 H 投影主视觉')
    expect(html).not.toContain('员工工作台')
    expect(html).not.toContain('统一的蓝白工作台')
    expect(html).not.toContain('登录后已自动识别所属公司')
  })
})
