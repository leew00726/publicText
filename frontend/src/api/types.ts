export type Unit = {
  id: string
  name: string
  code: string
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
