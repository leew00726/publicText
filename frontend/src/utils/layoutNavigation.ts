import { matchPath } from 'react-router-dom'

export const LAYOUT_HOME_PATH = '/layout/company-home'

type ResolveLayoutBackPathOptions = {
  docTopicId?: string | null
  topicCompanyId?: string | null
}

export function resolveLayoutBackPath(
  pathname: string,
  { docTopicId = null, topicCompanyId = null }: ResolveLayoutBackPathOptions = {},
): string | null {
  if (matchPath('/layout/docs/:id', pathname) && docTopicId) {
    return `/layout/topics/${docTopicId}/library`
  }

  if (matchPath('/layout/topics/:topicId/library', pathname) && topicCompanyId) {
    return `/layout/companies/${topicCompanyId}/topics`
  }

  if (matchPath('/layout/topics/:topicId', pathname) && topicCompanyId) {
    return `/layout/companies/${topicCompanyId}/topics`
  }

  if (matchPath('/layout/companies/:companyId/topics', pathname)) {
    return '/workspace'
  }

  if (matchPath(LAYOUT_HOME_PATH, pathname) || matchPath('/layout', pathname)) {
    return '/workspace'
  }

  return null
}
