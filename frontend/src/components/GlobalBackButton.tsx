import { useEffect, useMemo, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc } from '../api/types'

interface GlobalBackButtonProps {
  variant?: 'floating' | 'shell'
}

export function GlobalBackButton({ variant = 'floating' }: GlobalBackButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [docTopicId, setDocTopicId] = useState<string | null>(null)
  const [topicCompanyId, setTopicCompanyId] = useState<string | null>(null)

  const layoutRootMatch = useMemo(() => matchPath('/layout', location.pathname), [location.pathname])
  const managementRootMatch = useMemo(() => matchPath('/management', location.pathname), [location.pathname])
  const layoutSummaryMatch = useMemo(() => matchPath('/layout/summary', location.pathname), [location.pathname])

  const layoutCompanyHomeMatch = useMemo(() => matchPath('/layout/company-home', location.pathname), [location.pathname])
  const managementCompanyHomeMatch = useMemo(() => matchPath('/management/companies', location.pathname), [location.pathname])
  const layoutTopicListMatch = useMemo(() => matchPath('/layout/companies/:companyId/topics', location.pathname), [location.pathname])
  const managementTopicListMatch = useMemo(
    () => matchPath('/management/companies/:companyId/topics', location.pathname),
    [location.pathname],
  )

  const layoutTopicLibraryMatch = useMemo(() => matchPath('/layout/topics/:topicId/library', location.pathname), [location.pathname])
  const layoutTopicComposeMatch = useMemo(() => matchPath('/layout/topics/:topicId', location.pathname), [location.pathname])
  const managementTopicTrainMatch = useMemo(
    () => matchPath('/management/topics/:topicId/train', location.pathname),
    [location.pathname],
  )
  const layoutDocMatch = useMemo(() => matchPath('/layout/docs/:id', location.pathname), [location.pathname])

  const isDocPage = Boolean(layoutDocMatch?.params?.id)
  const docId = layoutDocMatch?.params?.id || null
  const currentTopicId =
    layoutTopicLibraryMatch?.params?.topicId ||
    layoutTopicComposeMatch?.params?.topicId ||
    managementTopicTrainMatch?.params?.topicId ||
    docTopicId ||
    null

  useEffect(() => {
    let cancelled = false
    if (!isDocPage || !docId) {
      setDocTopicId(null)
      return
    }

    void api
      .get<GovDoc>(`/api/layout/docs/${docId}`)
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
      .get<{ companyId: string }>(`/api/management/topics/${currentTopicId}`)
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
      return `/layout/topics/${docTopicId}/library`
    }
    if (layoutTopicLibraryMatch?.params?.topicId && topicCompanyId) {
      return `/layout/companies/${topicCompanyId}/topics`
    }
    if (layoutTopicComposeMatch?.params?.topicId && topicCompanyId) {
      return `/layout/companies/${topicCompanyId}/topics`
    }
    if (managementTopicTrainMatch?.params?.topicId && topicCompanyId) {
      return `/management/companies/${topicCompanyId}/topics`
    }
    if (layoutSummaryMatch) {
      return '/workspace'
    }
    if (layoutTopicListMatch?.params?.companyId) {
      return '/layout'
    }
    if (managementTopicListMatch?.params?.companyId) {
      return '/management/companies'
    }
    if (layoutCompanyHomeMatch) {
      return '/layout'
    }
    if (managementCompanyHomeMatch) {
      return '/management'
    }
    if (layoutRootMatch || managementRootMatch) {
      return '/workspace'
    }
    return null
  }, [
    isDocPage,
    docTopicId,
    layoutTopicLibraryMatch,
    layoutTopicComposeMatch,
    managementTopicTrainMatch,
    topicCompanyId,
    layoutSummaryMatch,
    layoutTopicListMatch,
    managementTopicListMatch,
    layoutCompanyHomeMatch,
    managementCompanyHomeMatch,
    layoutRootMatch,
    managementRootMatch,
  ])

  if (location.pathname === '/' || location.pathname === '/workspace') {
    return null
  }

  return (
    <button
      type="button"
      className={`global-back-btn ${variant}`}
      onClick={() => {
        if (fixedBackPath) {
          navigate(fixedBackPath)
          return
        }
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate('/workspace')
        }
      }}
    >
      {isDocPage && docTopicId ? '返回库' : '返回上一级'}
    </button>
  )
}
