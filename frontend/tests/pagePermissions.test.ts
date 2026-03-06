import { describe, expect, it } from 'vitest'

import { canAccessPage, canPerformAction } from '../src/utils/pagePermissions'

describe('page permissions', () => {
  it('allows staff to access layout pages only', () => {
    expect(canAccessPage('staff', 'layout.home')).toBe(true)
    expect(canAccessPage('staff', 'layout.docEditor')).toBe(true)
    expect(canAccessPage('staff', 'management.home')).toBe(false)
    expect(canAccessPage('staff', 'management.topicTrain')).toBe(false)
  })

  it('allows admin to access both layout and management pages', () => {
    expect(canAccessPage('admin', 'layout.summary')).toBe(true)
    expect(canAccessPage('admin', 'management.home')).toBe(true)
    expect(canAccessPage('admin', 'management.company')).toBe(true)
    expect(canAccessPage('admin', 'management.topicTrain')).toBe(true)
  })

  it('restricts destructive actions to admin only', () => {
    expect(canPerformAction('staff', 'management.template.delete')).toBe(false)
    expect(canPerformAction('staff', 'management.doc.delete')).toBe(false)
    expect(canPerformAction('admin', 'management.template.delete')).toBe(true)
    expect(canPerformAction('admin', 'management.doc.delete')).toBe(true)
  })
})
