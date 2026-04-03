const PLACEHOLDER_STAGES = [
  {
    index: '01',
    title: '会前材料汇集',
    description: '后续会支持上传议程、会议通知、录音转写和参会名单，统一沉淀会议输入源。',
  },
  {
    index: '02',
    title: '纪要草稿生成',
    description: '预留纪要结构化生成能力，后续会补充议题归纳、结论提炼和责任人映射。',
  },
  {
    index: '03',
    title: '会后流转归档',
    description: '未来会接入审阅、发送、待办追踪和历史归档，形成完整会议纪要闭环。',
  },
]

export function MeetingMinutesPage() {
  return (
    <main className="page workspace-page meeting-minutes-page">
      <section className="glass-card meeting-minutes-hero">
        <p className="meeting-minutes-kicker">Meeting Minutes</p>
        <h2>会议纪要</h2>
        <p>
          前端占位模块，当前仅开放界面占位，用于提前预留工作台入口和后续的会议纪要产品形态。
        </p>
        <div className="meeting-minutes-hero-meta" aria-label="会议纪要模块状态">
          <span className="soft-pill">功能建设中</span>
          <span className="soft-pill">当前仅开放界面占位</span>
          <span className="soft-pill">后续接入会议纪要生成流程</span>
        </div>
      </section>

      <section className="meeting-minutes-grid" aria-label="会议纪要阶段规划">
        {PLACEHOLDER_STAGES.map((stage) => (
          <article key={stage.index} className="glass-card meeting-minutes-stage">
            <span className="meeting-minutes-stage-index">{stage.index}</span>
            <strong>{stage.title}</strong>
            <p>{stage.description}</p>
          </article>
        ))}
      </section>

      <section className="glass-card meeting-minutes-roadmap">
        <h3>当前说明</h3>
        <p>这一版只提供前端模块和占位页面，不接入录音识别、纪要生成、发送流转或归档能力。</p>
        <ul className="meeting-minutes-list">
          <li>工作台已增加“会议纪要”入口，方便后续功能直接接入。</li>
          <li>当前进入后会展示规划内容和阶段说明，不影响现有公文总结、排版、管理模块。</li>
          <li>后续开发时可以在此页面继续扩展上传、草稿、审批和归档等功能区块。</li>
        </ul>
        <button type="button" className="secondary-button" disabled>
          功能建设中
        </button>
      </section>
    </main>
  )
}
