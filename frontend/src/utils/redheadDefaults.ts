import type { RedheadTemplate } from '../api/types'

export function buildDefaultTemplateA(unitId: string): Omit<RedheadTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    unitId,
    name: '模板A（简版）',
    version: 1,
    status: 'draft',
    isDefault: false,
    scope: 'firstPageOnly',
    note: '新建模板',
    page: { paper: 'A4', marginsCm: { top: 3.7, bottom: 3.5, left: 2.7, right: 2.5 } },
    elements: [
      {
        id: `unitName-${Date.now()}`,
        enabled: true,
        type: 'text',
        bind: 'unitName',
        fixedText: null,
        visibleIfEmpty: false,
        x: { anchor: 'center', offsetCm: 0 },
        yCm: 1,
        text: {
          align: 'center',
          font: { family: '方正小标宋简', sizePt: 22, bold: false, color: '#D40000', letterSpacingPt: 0 },
        },
        line: null,
      },
      {
        id: `line-${Date.now()}`,
        enabled: true,
        type: 'line',
        bind: 'fixedText',
        fixedText: null,
        visibleIfEmpty: false,
        x: { anchor: 'marginLeft', offsetCm: 0 },
        yCm: 2.2,
        text: null,
        line: { lengthMode: 'contentWidth', lengthCm: null, thicknessPt: 1.5, color: '#D40000' },
      },
    ],
  }
}
