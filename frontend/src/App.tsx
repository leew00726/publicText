import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { GlobalBackButton } from './components/GlobalBackButton'
import { CompanySelectPage } from './pages/CompanySelectPage'
import { DocEditorPage } from './pages/DocEditorPage'
import { LoginPage } from './pages/LoginPage'
import { ModuleHubPage } from './pages/ModuleHubPage'
import { TopicComposePage } from './pages/TopicComposePage'
import { TopicDetailPage } from './pages/TopicDetailPage'
import { TopicLibraryPage } from './pages/TopicLibraryPage'
import { TopicListPage } from './pages/TopicListPage'
import { loadEmployeeSession } from './utils/employeeAuth'

function RequireEmployeeAuth({ children }: { children: JSX.Element }) {
  const location = useLocation()
  if (!loadEmployeeSession()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return children
}

function AuthLandingRoute() {
  if (loadEmployeeSession()) {
    return <Navigate to="/workspace" replace />
  }
  return <LoginPage />
}

function FallbackRoute() {
  return <Navigate to={loadEmployeeSession() ? '/workspace' : '/'} replace />
}

export default function App() {
  return (
    <>
      <GlobalBackButton />
      <Routes>
        <Route path="/" element={<AuthLandingRoute />} />
        <Route
          path="/workspace"
          element={
            <RequireEmployeeAuth>
              <ModuleHubPage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/companies"
          element={
            <RequireEmployeeAuth>
              <CompanySelectPage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/companies/:companyId/topics"
          element={
            <RequireEmployeeAuth>
              <TopicListPage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/topics/:topicId"
          element={
            <RequireEmployeeAuth>
              <TopicComposePage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/topics/:topicId/library"
          element={
            <RequireEmployeeAuth>
              <TopicLibraryPage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/topics/:topicId/train"
          element={
            <RequireEmployeeAuth>
              <TopicDetailPage />
            </RequireEmployeeAuth>
          }
        />
        <Route
          path="/docs/:id"
          element={
            <RequireEmployeeAuth>
              <DocEditorPage />
            </RequireEmployeeAuth>
          }
        />
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </>
  )
}
