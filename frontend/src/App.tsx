import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CompanySelectPage } from './pages/CompanySelectPage'
import { DocumentSummaryPage } from './pages/DocumentSummaryPage'
import { DocEditorPage } from './pages/DocEditorPage'
import { LoginPage } from './pages/LoginPage'
import { ManagementModulePage } from './pages/ManagementModulePage'
import { ModuleHubPage } from './pages/ModuleHubPage'
import { TopicComposePage } from './pages/TopicComposePage'
import { TopicDetailPage } from './pages/TopicDetailPage'
import { TopicLibraryPage } from './pages/TopicLibraryPage'
import { TopicListPage } from './pages/TopicListPage'
import { loadEmployeeSession, saveEmployeeSession } from './utils/employeeAuth'
import { ensureEmployeeCompany } from './utils/employeeCompany'
import { LAYOUT_HOME_PATH } from './utils/layoutNavigation'
import { canAccessPage, type PagePermissionKey } from './utils/pagePermissions'

function RequirePageAccess({ permission, children }: { permission: PagePermissionKey; children: JSX.Element }) {
  const location = useLocation()
  const session = loadEmployeeSession()
  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  if (!canAccessPage(session.role, permission)) {
    return <Navigate to="/workspace" replace state={{ deniedPath: location.pathname }} />
  }
  return children
}

function WithShell({ children }: { children: JSX.Element }) {
  return <AppShell>{children}</AppShell>
}

function AuthLandingRoute() {
  if (loadEmployeeSession()) {
    return <Navigate to={LAYOUT_HOME_PATH} replace />
  }
  return <LoginPage />
}

function EmployeeCompanyHomeRoute() {
  const [targetPath, setTargetPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const session = loadEmployeeSession()
    if (!session) {
      setTargetPath('/')
      return () => {
        cancelled = true
      }
    }

    if (session.companyId) {
      setTargetPath(`/layout/companies/${session.companyId}/topics`)
      return () => {
        cancelled = true
      }
    }

    void ensureEmployeeCompany(session.username)
      .then((company) => {
        if (cancelled) return
        saveEmployeeSession({
          ...session,
          companyId: company.id,
          companyName: company.name,
        })
        setTargetPath(`/layout/companies/${company.id}/topics`)
      })
      .catch((error: any) => {
        if (cancelled) return
        const detail = error?.response?.data?.detail || '无法识别员工所属公司，请联系管理员。'
        setErrorMessage(String(detail))
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (targetPath) {
    return <Navigate to={targetPath} replace />
  }
  if (errorMessage) {
    return <div className="page">{errorMessage}</div>
  }
  return <div className="page">正在进入所属公司公文库...</div>
}

function LegacyCompanyTopicsRedirect() {
  const { companyId = '' } = useParams()
  return <Navigate to={`/layout/companies/${companyId}/topics`} replace />
}

function LegacyTopicComposeRedirect() {
  const { topicId = '' } = useParams()
  return <Navigate to={`/layout/topics/${topicId}`} replace />
}

function LegacyTopicLibraryRedirect() {
  const { topicId = '' } = useParams()
  return <Navigate to={`/layout/topics/${topicId}/library`} replace />
}

function LegacyTopicTrainRedirect() {
  const { topicId = '' } = useParams()
  return <Navigate to={`/management/topics/${topicId}/train`} replace />
}

function LegacyDocRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={`/layout/docs/${id}`} replace />
}

function FallbackRoute() {
  return <Navigate to={loadEmployeeSession() ? LAYOUT_HOME_PATH : '/'} replace />
}

function withShell(permission: PagePermissionKey, child: JSX.Element) {
  return (
    <RequirePageAccess permission={permission}>
      <WithShell>{child}</WithShell>
    </RequirePageAccess>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthLandingRoute />} />
      <Route path="/workspace" element={withShell('workspace.home', <ModuleHubPage />)} />
      <Route path="/layout" element={<Navigate to={LAYOUT_HOME_PATH} replace />} />
      <Route path="/layout/summary" element={withShell('layout.summary', <DocumentSummaryPage />)} />
      <Route path="/layout/company-home" element={withShell('layout.company', <EmployeeCompanyHomeRoute />)} />
      <Route path="/layout/companies" element={<Navigate to="/layout/company-home" replace />} />
      <Route path="/layout/companies/:companyId/topics" element={withShell('layout.topicList', <TopicListPage mode="layout" />)} />
      <Route path="/layout/topics/:topicId" element={withShell('layout.topicCompose', <TopicComposePage />)} />
      <Route path="/layout/topics/:topicId/library" element={withShell('layout.topicLibrary', <TopicLibraryPage />)} />
      <Route path="/layout/docs/:id" element={withShell('layout.docEditor', <DocEditorPage />)} />
      <Route path="/management" element={withShell('management.home', <ManagementModulePage />)} />
      <Route path="/management/companies" element={withShell('management.company', <CompanySelectPage mode="management" />)} />
      <Route
        path="/management/companies/:companyId/topics"
        element={withShell('management.topicList', <TopicListPage mode="management" />)}
      />
      <Route path="/management/topics/:topicId/train" element={withShell('management.topicTrain', <TopicDetailPage />)} />
      <Route path="/summary" element={<Navigate to="/layout/summary" replace />} />
      <Route path="/companies" element={<Navigate to="/layout/company-home" replace />} />
      <Route path="/companies/:companyId/topics" element={<LegacyCompanyTopicsRedirect />} />
      <Route path="/topics/:topicId" element={<LegacyTopicComposeRedirect />} />
      <Route path="/topics/:topicId/library" element={<LegacyTopicLibraryRedirect />} />
      <Route path="/topics/:topicId/train" element={<LegacyTopicTrainRedirect />} />
      <Route path="/docs/:id" element={<LegacyDocRedirect />} />
      <Route path="*" element={<FallbackRoute />} />
    </Routes>
  )
}
