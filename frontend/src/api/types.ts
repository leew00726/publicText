export type Unit = {
  id: string
  name: string
}

export type RedheadElement = {
  id: string
  enabled: boolean
  type: 'text' | 'line'
  bind: 'unitName' | 'docNo' | 'signatory' | 'copyNo' | 'fixedText'
  fixedText?: string | null
  visibleIfEmpty?: boolean
  x: { anchor: 'marginLeft' | 'center' | 'marginRight'; offsetCm: number }
  yCm: number
  text?: {
    align: 'left' | 'center' | 'right'
    font: { family: string; sizePt: number; bold: boolean; color: string; letterSpacingPt: number }
  } | null
  line?: {
    lengthMode: 'contentWidth' | 'custom'
    lengthCm?: number | null
    thicknessPt: number
    color: string
  } | null
}

export type RedheadTemplate = {
  id: string
  unitId: string
  name: string
  version: number
  status: 'draft' | 'published' | 'disabled'
  isDefault: boolean
  scope: 'firstPageOnly'
  note?: string | null
  page: {
    paper: 'A4'
    marginsCm: { top: number; bottom: number; left: number; right: number }
  }
  elements: RedheadElement[]
  createdAt: string
  updatedAt: string
}

export type AttachmentItem = {
  index: number
  name: string
}

export type StructuredFields = {
  title: string
  mainTo: string
  signOff: string
  docNo: string
  signatory: string
  copyNo: string
  date: string
  exportWithRedhead: boolean
  attachments: AttachmentItem[]
  topicId?: string | null
  topicName?: string | null
  topicTemplateId?: string | null
  topicTemplateVersion?: number | null
  topicTemplateRules?: Record<string, any> | null
}

export type GovDoc = {
  id: string
  title: string
  docType: 'qingshi' | 'jiyao' | 'han' | 'tongzhi'
  unitId: string
  redheadTemplateId?: string | null
  status: string
  structuredFields: StructuredFields
  body: any
  importReport?: any
  createdAt: string
  updatedAt: string
}

export type CheckIssue = {
  code: string
  type: 'A' | 'B'
  message: string
  path: string
  level: 'error' | 'warning'
}

export type Topic = {
  id: string
  companyId: string
  name: string
  code: string
  description?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export type TopicDraft = {
  id: string
  topicId: string
  version: number
  status: string
  inferredRules: Record<string, any>
  confidenceReport: Record<string, any>
  agentSummary?: string | null
  createdAt: string
  updatedAt: string
}

export type TopicAnalyzeResponse = {
  topicId: string
  draft: TopicDraft
}

export type TopicTemplate = {
  id: string
  topicId: string
  version: number
  rules: Record<string, any>
  sourceDraftId?: string | null
  effective: boolean
  createdAt: string
}

export type TopicConfirmResponse = {
  topicId: string
  template: TopicTemplate
}

export type DeletionAuditEvent = {
  id: string
  companyId: string
  topicId?: string | null
  fileCount: number
  totalBytes: number
  status: string
  errorCode?: string | null
  startedAt: string
  endedAt: string
}

