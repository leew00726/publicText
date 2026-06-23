import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { DepartmentManagementPage } from './DepartmentManagementPage'


describe('DepartmentManagementPage', () => {
  it('renders departments, company documents, and the topic management action', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DepartmentManagementPage
          initialCompanyName="云成数科"
          initialDocuments={[
            {
              id: 'doc-1',
              title: '关于推进供应链金融业务的请示',
              docType: 'qingshi',
              unitId: 'company-1',
              status: 'draft',
              structuredFields: {
                title: '关于推进供应链金融业务的请示',
                mainTo: '',
                signOff: '',
                docNo: '云科〔2026〕12号',
                signatory: '',
                copyNo: '',
                date: '',
                exportWithRedhead: false,
                attachments: [],
              },
              body: { type: 'doc', content: [] },
              createdAt: '2026-06-18T08:00:00Z',
              updatedAt: '2026-06-18T09:30:00Z',
            },
          ]}
          initialDepartments={[
            {
              id: 'department-leaders',
              companyId: 'company-1',
              name: '公司领导',
              code: 'leaders',
              sortOrder: 0,
              memberCount: 1,
              members: [
                {
                  id: 'person-1',
                  employeeNo: '80051081',
                  name: '金刚善',
                  subDepartmentName: null,
                  hasLogin: true,
                },
              ],
            },
            {
              id: 'department-platform',
              companyId: 'company-1',
              name: '平台开发与科技管理部',
              code: 'platform',
              sortOrder: 1,
              memberCount: 2,
              members: [
                {
                  id: 'person-2',
                  employeeNo: '82051871',
                  name: '杨琨',
                  subDepartmentName: null,
                  hasLogin: true,
                },
                {
                  id: 'person-3',
                  employeeNo: null,
                  name: '高创创',
                  subDepartmentName: null,
                  hasLogin: false,
                },
              ],
            },
          ]}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('云成数科')
    expect(html).toContain('2 个部门')
    expect(html).toContain('公司领导')
    expect(html).toContain('平台开发与科技管理部')
    expect(html).not.toContain('<strong>1</strong>')
    expect(html).not.toContain('<strong>2</strong>')
    expect(html).toContain('公文列表')
    expect(html).toContain('关于推进供应链金融业务的请示')
    expect(html).toContain('请示')
    expect(html).toContain('编辑中')
    expect(html).toContain('搜索公文')
    expect(html).not.toContain('金刚善')
    expect(html).not.toContain('账号状态')
    expect(html).toContain('进入题材管理')
  })

  it('loads the document list for the current company', () => {
    const source = DepartmentManagementPage.toString()

    expect(source).toContain('/api/layout/docs')
    expect(source).toContain('unitId: companyId')
  })

  it('uploads a DOCX file into the current company document library', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DepartmentManagementPage
          initialCompanyName="云成数科"
          initialDepartments={[]}
          initialDocuments={[]}
        />
      </MemoryRouter>,
    )
    const source = DepartmentManagementPage.toString()

    expect(html).toContain('上传文件')
    expect(html).toContain('accept=".docx')
    expect(source).toContain('/api/layout/docs/importDocx')
    expect(source).toMatch(/form\.append\(["']unitId["'], companyId\)/)
    expect(source).toContain('仅支持 DOCX 文件')
    expect(source).toContain('上传成功')
  })
})
