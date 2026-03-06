import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, meta, actions }: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="page-header-copy">
        <p className="page-eyebrow">{eyebrow}</p>
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {meta ? <div className="page-header-meta">{meta}</div> : null}
        </div>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </section>
  )
}
