import { useEffect, useMemo, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc } from '../api/types'

export function GlobalBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const [docTopicId, setDocTopicId] = useState<string | null>(null)
  const [topicCompanyId, setTopicCompanyId] = useState<string | null>(null)

  const docMatch = useMemo(() => matchPath('/docs/:id', location.pathname), [location.pathname])
  const topicListMatch = useMemo(() => matchPath('/companies/:companyId/topics', location.pathname), [location.pathname])
  const topicLibraryMatch = useMemo(() => matchPath('/topics/:topicId/library', location.pathname), [location.pathname])
  const topicComposeMatch = useMemo(() => matchPath('/topics/:topicId', location.pathname), [location.pathname])
  const topicTrainMatch = useMemo(() => matchPath('/topics/:topicId/train', location.pathname), [location.pathname])

  const isDocPage = Boolean(docMatch?.params?.id)
  const docId = docMatch?.params?.id || null
  const currentTopicId =
    topicLibraryMatch?.params?.topicId ||
    topicComposeMatch?.params?.topicId ||
    topicTrainMatch?.params?.topicId ||
    docTopicId ||
    null

  useEffect(() => {
    let cancelled = false
    if (!isDocPage || !docId) {
      setDocTopicId(null)
      return
    }

    void api
      .get<GovDoc>(`/api/docs/${docId}`)
      .then((res) => {
        if (cancelled) return
        setDocTopicId(res.data?.structuredFields?.topicId || null)
      })
      .catch(() => {
        if (cancelled) return
        setDocTopicId(null)
      })

    return () => {
      cancelled = true
    }
  }, [isDocPage, docId])

  useEffect(() => {
    let cancelled = false
    if (!currentTopicId) {
      setTopicCompanyId(null)
      return
    }

    void api
      .get<{ companyId: string }>(`/api/topics/${currentTopicId}`)
      .then((res) => {
        if (cancelled) return
        setTopicCompanyId(res.data?.companyId || null)
      })
      .catch(() => {
        if (cancelled) return
        setTopicCompanyId(null)
      })

    return () => {
      cancelled = true
    }
  }, [currentTopicId])

  const fixedBackPath = useMemo(() => {
    if (isDocPage && docTopicId) {
      return `/topics/${docTopicId}/library`
    }
    if (topicLibraryMatch?.params?.topicId && topicCompanyId) {
      return `/companies/${topicCompanyId}/topics`
    }
    if ((topicComposeMatch?.params?.topicId || topicTrainMatch?.params?.topicId) && topicCompanyId) {
      return `/companies/${topicCompanyId}/topics`
    }
    if (topicListMatch?.params?.companyId) {
      return '/'
    }
    return null
  }, [isDocPage, docTopicId, topicLibraryMatch, topicComposeMatch, topicTrainMatch, topicCompanyId, topicListMatch])

  if (location.pathname === '/') {
    return null
  }

  return (
    <button
      type="button"
      className="global-back-btn"
      onClick={() => {
        if (fixedBackPath) {
          navigate(fixedBackPath)
          return
        }
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate('/')
        }
      }}
    >
      {isDocPage && docTopicId ? '返回库' : '返回上一级'}
    </button>
  )
}
