import { useMemo, type ReactNode } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'

import { clearEmployeeSession, loadEmployeeSession } from '../utils/employeeAuth'
import { LAYOUT_HOME_PATH } from '../utils/layoutNavigation'
import { GlobalBackButton } from './GlobalBackButton'

type AppShellProps = {
  children: ReactNode
}

type PageMeta = {
  kicker: string
  title: string
  subtitle: string
}

const PAGE_META_ROUTES: Array<{ path: string; meta: PageMeta }> = [
  {
    path: '/workspace',
    meta: {
      kicker: 'Workspace',
      title: '云矩公文管理平台',
      subtitle: '',
    },
  },
  {
    path: '/layout/summary',
    meta: {
      kicker: '',
      title: '公文总结',
      subtitle: '',
    },
  },
  {
    path: '/meeting-minutes',
    meta: {
      kicker: 'Meeting',
      title: '会议纪要',
      subtitle: '前端占位模块，预留会议纪要整理、生成与归档入口。',
    },
  },
  {
    path: LAYOUT_HOME_PATH,
    meta: {
      kicker: 'Layout',
      title: '公文排版',
      subtitle: '直接进入所属公司题材库，继续文档排版与输出流程。',
    },
  },
  {
    path: '/layout',
    meta: {
      kicker: 'Layout',
      title: '公文排版',
      subtitle: '聚焦文档导入、正文排版、校验和导出。',
    },
  },
  {
    path: '/layout/companies/:companyId/topics',
    meta: {
      kicker: 'Topics',
      title: '题材库',
      subtitle: '按公司浏览题材，进入文档库或正文编辑入口。',
    },
  },
  {
    path: '/layout/topics/:topicId',
    meta: {
      kicker: 'Compose',
      title: '正文编辑入口',
      subtitle: '选择模板版本并创建新的正文编辑文档。',
    },
  },
  {
    path: '/layout/topics/:topicId/library',
    meta: {
      kicker: 'Library',
      title: '文档库',
      subtitle: '按题材查看既有文档，继续编辑或删除。',
    },
  },
  {
    path: '/layout/docs/:id',
    meta: {
      kicker: 'Editor',
      title: '正文排版工作区',
      subtitle: '结构化字段、智能润色、规范校验与 DOCX 导出。',
    },
  },
  {
    path: '/management',
    meta: {
      kicker: 'Management',
      title: '公文管理',
      subtitle: '维护公司、题材、模板版本与治理流程。',
    },
  },
  {
    path: '/management/companies',
    meta: {
      kicker: 'Companies',
      title: '公司管理',
      subtitle: '维护公司主数据并进入题材治理流程。',
    },
  },
  {
    path: '/management/companies/:companyId/topics',
    meta: {
      kicker: 'Governance',
      title: '题材治理',
      subtitle: '管理题材、模板版本和文档库。',
    },
  },
  {
    path: '/management/topics/:topicId/train',
    meta: {
      kicker: 'Training',
      title: '模板训练',
      subtitle: '上传材料、修订草稿并确认模板版本。',
    },
  },
]

function resolvePageMeta(pathname: string): PageMeta {
  for (const route of PAGE_META_ROUTES) {
    if (matchPath(route.path, pathname)) {
      return route.meta
    }
  }

  return {
    kicker: 'PublicText',
    title: '办公系统',
    subtitle: '统一处理公文总结、排版和治理任务。',
  }
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = loadEmployeeSession()
  const currentMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname])
  const isSummaryShell = useMemo(() => Boolean(matchPath('/layout/summary', location.pathname)), [location.pathname])
  const showWorkspaceTitleLogo = useMemo(() => Boolean(matchPath('/workspace', location.pathname)), [location.pathname])
  const companyName = session?.companyName || '云成数科'

  if (!session) {
    return <>{children}</>
  }

  return (
    <div className={`app-shell${isSummaryShell ? ' app-shell-summary' : ''}`}>
      <div className={`app-shell-main${isSummaryShell ? ' app-shell-main-summary' : ''}`}>
        <header className={`app-shell-topbar${isSummaryShell ? ' shell-topbar-summary' : ''}`}>
          <div className="shell-topbar-left">
            <GlobalBackButton variant="shell" />
            <div className="shell-topbar-copy">
              {currentMeta.kicker ? <p className="shell-topbar-kicker">{currentMeta.kicker}</p> : null}
              <div className={`shell-topbar-title-row${showWorkspaceTitleLogo ? ' is-brand' : ''}`}>
                {showWorkspaceTitleLogo ? <img className="shell-topbar-title-logo" src="/huaneng-logo.jpg" alt="华能标志" /> : null}
                <h1>{currentMeta.title}</h1>
              </div>
              {currentMeta.subtitle ? <p>{currentMeta.subtitle}</p> : null}
            </div>
          </div>

          <div className="shell-topbar-right">
            <div className="shell-session-card">
              <span className="shell-session-label">{companyName}</span>
              <strong>{session.username}</strong>
            </div>
            <button
              type="button"
              className="shell-logout-btn"
              onClick={() => {
                clearEmployeeSession()
                navigate('/', { replace: true })
              }}
            >
              退出登录
            </button>
          </div>
        </header>

        <div className="app-shell-scroll">{children}</div>
      </div>
    </div>
  )
}
