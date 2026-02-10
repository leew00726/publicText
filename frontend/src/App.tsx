import { Navigate, Route, Routes } from 'react-router-dom'
import { CompanySelectPage } from './pages/CompanySelectPage'
import { DocEditorPage } from './pages/DocEditorPage'
import { DocsListPage } from './pages/DocsListPage'
import { TopicDetailPage } from './pages/TopicDetailPage'
import { TopicListPage } from './pages/TopicListPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CompanySelectPage />} />
      <Route path="/companies/:companyId/topics" element={<TopicListPage />} />
      <Route path="/topics/:topicId" element={<TopicDetailPage />} />
      <Route path="/docs" element={<DocsListPage />} />
      <Route path="/docs/:id" element={<DocEditorPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
