import { describe, expect, it } from 'vitest'

import { canAccessCompany, canAccessPage, canPerformAction } from '../src/utils/pagePermissions'

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

  it('can evaluate explicit session permissions from backend login', () => {
    const session = {
      username: '82000001',
      role: 'staff' as const,
      loginAt: '2026-03-02T08:00:00.000Z',
      companyId: 'company-a',
      companyName: '甲公司',
      permissions: ['workspace.home', 'layout.topicList', 'management.topic.delete'],
    }

    expect(canAccessPage(session, 'layout.topicList')).toBe(true)
    expect(canAccessPage(session, 'layout.summary')).toBe(false)
    expect(canPerformAction(session, 'management.topic.delete')).toBe(true)
    expect(canPerformAction(session, 'management.doc.delete')).toBe(false)
  })

  it('restricts layout company routes to the employee bound company', () => {
    const session = {
      username: '82000001',
      role: 'admin' as const,
      loginAt: '2026-03-02T08:00:00.000Z',
      companyId: 'company-a',
      companyName: '甲公司',
      permissions: ['workspace.home', 'layout.topicList', 'management.company'],
    }

    expect(canAccessCompany(session, 'company-a')).toBe(true)
    expect(canAccessCompany(session, ' company-a ')).toBe(true)
    expect(canAccessCompany(session, 'company-b')).toBe(false)
    expect(canAccessCompany(session, '')).toBe(false)
    expect(canAccessCompany(session, 'company-b', 'any')).toBe(true)
  })
})
