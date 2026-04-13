import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ModuleHubPage } from './ModuleHubPage'

const pagesCssPath = path.resolve(__dirname, '../styles/pages.css')

vi.mock('../utils/employeeAuth', () => ({
  loadEmployeeSession: vi.fn(() => ({
    username: 'treter',
    displayName: '张三',
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
    {
      key: 'meetingMinutes',
      title: '会议纪要',
      description: '会后整理会议议程、结论和待办事项，后续将接入完整纪要生成流程。',
      entryPath: '/meeting-minutes',
      enabled: true,
    },
  ]),
}))

describe('ModuleHubPage', () => {
  it('renders a redesigned workspace dashboard without the hologram banner', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <ModuleHubPage />
      </MemoryRouter>,
    )

    expect(html).toContain('workspace-hero')
    expect(html).toContain('今日工作台')
    expect(html).toContain('当前可用模块')
    expect(html).toContain('欢迎回来，张三')
    expect(html).toContain('公司归属')
    expect(html).toContain('当前可用 4 个模块')
    expect(html).toContain('公文总结')
    expect(html).toContain('公文排版')
    expect(html).toContain('公文管理')
    expect(html).toContain('会议纪要')
    expect(html).toContain('进入公文总结')
    expect(html).toContain('进入公文排版')
    expect(html).toContain('进入会议纪要')
    expect(html).not.toContain('模块总数')
    expect(html).not.toContain('统一进入公文总结、公文排版和公文管理模块。')
    expect(html).not.toContain('这里不再放装饰横幅')
    expect(html).not.toContain('workspace-quick-grid')

    expect(html).not.toContain('中国华能')
    expect(html).not.toContain('module-h-hero')
    expect(html).not.toContain('data-particle-shape=')
  })

  it('uses a four-column workspace module grid on desktop when four modules are available', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.workspace-module-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/)
  })
})
