import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  confirmDiscardUnsavedEditorChanges,
  hasUnsavedEditorChanges,
  registerEditorUnsavedCheck,
  UNSAVED_EDITOR_MESSAGE,
} from './editorUnsavedChanges'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editor unsaved changes guard', () => {
  it('tracks registered dirty editors and cleans them up', () => {
    const unregister = registerEditorUnsavedCheck(() => true)
    expect(hasUnsavedEditorChanges()).toBe(true)
    unregister()
    expect(hasUnsavedEditorChanges()).toBe(false)
  })

  it('asks for confirmation only when an editor is dirty', () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('window', { confirm })

    expect(confirmDiscardUnsavedEditorChanges()).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    const unregister = registerEditorUnsavedCheck(() => true)
    expect(confirmDiscardUnsavedEditorChanges()).toBe(false)
    expect(confirm).toHaveBeenCalledWith(UNSAVED_EDITOR_MESSAGE)
    unregister()
  })
})
