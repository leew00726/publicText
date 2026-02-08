import { Navigate, Route, Routes } from 'react-router-dom'
import { DocEditorPage } from './pages/DocEditorPage'
import { DocsListPage } from './pages/DocsListPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DocsListPage />} />
      <Route path="/docs/:id" element={<DocEditorPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
