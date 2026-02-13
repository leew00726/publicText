import { Navigate, Route, Routes } from 'react-router-dom'
import { GlobalBackButton } from './components/GlobalBackButton'
import { CompanySelectPage } from './pages/CompanySelectPage'
import { DocEditorPage } from './pages/DocEditorPage'
import { TopicComposePage } from './pages/TopicComposePage'
import { TopicDetailPage } from './pages/TopicDetailPage'
import { TopicListPage } from './pages/TopicListPage'

export default function App() {
  return (
    <>
      <GlobalBackButton />
      <Routes>
        <Route path="/" element={<CompanySelectPage />} />
        <Route path="/companies/:companyId/topics" element={<TopicListPage />} />
        <Route path="/topics/:topicId" element={<TopicComposePage />} />
        <Route path="/topics/:topicId/train" element={<TopicDetailPage />} />
        <Route path="/docs/:id" element={<DocEditorPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}
