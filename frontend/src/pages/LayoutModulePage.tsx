import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'

export function LayoutModulePage() {
  const navigate = useNavigate()

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow="Layout"
        title="公文排版"
        description="聚焦文档处理与输出链路，统一导入、排版、校验和导出体验。"
        meta={<span className="soft-pill">文档处理与输出</span>}
      />

      <section className="module-grid domain-grid" aria-label="排版模块能力入口">
        <article className="glass-card domain-card">
          <div className="module-card-header">
            <p className="module-tag">Production</p>
            <span className="status-pill ready">已就绪</span>
          </div>
          <h2>正文排版生产线</h2>
          <p>进入现有正文编辑流程，继续导入、套版、校验与导出工作。</p>
          <button type="button" onClick={() => navigate('/layout/company-home')}>
            进入排版流程
          </button>
        </article>

        <article className="glass-card domain-card disabled">
          <div className="module-card-header">
            <p className="module-tag">Queue</p>
            <span className="status-pill warning">建设中</span>
          </div>
          <h2>排版任务看板</h2>
          <p>后续将沉淀批处理队列、重试状态和发布记录，形成统一任务跟踪入口。</p>
          <button type="button" disabled>
            建设中
          </button>
        </article>
      </section>
    </main>
  )
}
