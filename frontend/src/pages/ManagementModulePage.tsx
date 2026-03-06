import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'

export function ManagementModulePage() {
  const navigate = useNavigate()

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow="Management"
        title="公文管理"
        description="聚焦主数据与治理链路，维护公司、题材、模板版本和审计流程。"
        meta={<span className="soft-pill is-admin">管理员入口</span>}
      />

      <section className="module-grid domain-grid" aria-label="管理模块能力入口">
        <article className="glass-card domain-card">
          <div className="module-card-header">
            <p className="module-tag">Master Data</p>
            <span className="status-pill ready">已就绪</span>
          </div>
          <h2>公司与题材管理</h2>
          <p>维护组织与题材主数据，作为排版工作流和模板治理的统一入口。</p>
          <button type="button" onClick={() => navigate('/management/companies')}>
            进入管理入口
          </button>
        </article>

        <article className="glass-card domain-card">
          <div className="module-card-header">
            <p className="module-tag">Template</p>
            <span className="status-pill ready">持续治理</span>
          </div>
          <h2>模板训练与版本治理</h2>
          <p>继续沿用现有题材训练流程，并逐步沉淀为统一的模板治理视图。</p>
          <button type="button" onClick={() => navigate('/management/companies')}>
            进入模板治理
          </button>
        </article>
      </section>
    </main>
  )
}
