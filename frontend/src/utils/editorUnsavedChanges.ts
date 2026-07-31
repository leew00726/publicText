export const UNSAVED_EDITOR_MESSAGE = '当前文档还有未保存的修改，离开后这些修改将丢失。确定离开吗？'

type UnsavedCheck = () => boolean

const unsavedChecks = new Set<UnsavedCheck>()

export function registerEditorUnsavedCheck(check: UnsavedCheck): () => void {
  unsavedChecks.add(check)
  return () => {
    unsavedChecks.delete(check)
  }
}

export function hasUnsavedEditorChanges(): boolean {
  return Array.from(unsavedChecks).some((check) => check())
}

export function confirmDiscardUnsavedEditorChanges(): boolean {
  if (!hasUnsavedEditorChanges()) return true
  return window.confirm(UNSAVED_EDITOR_MESSAGE)
}
