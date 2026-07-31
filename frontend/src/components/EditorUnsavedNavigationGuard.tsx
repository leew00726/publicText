import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'

import { confirmDiscardUnsavedEditorChanges } from '../utils/editorUnsavedChanges'

export function shouldBlockUnsavedEditorNavigation(when: boolean, historyAction: string): boolean {
  return when && historyAction === 'POP'
}

function DataRouterPopGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(({ historyAction }) => shouldBlockUnsavedEditorNavigation(when, historyAction))

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (confirmDiscardUnsavedEditorChanges()) {
      window.setTimeout(blocker.proceed, 0)
    } else {
      blocker.reset()
    }
  }, [blocker])

  return null
}

export function EditorUnsavedNavigationGuard({ when }: { when: boolean }) {
  const dataRouterContext = useContext(UNSAFE_DataRouterContext)
  if (!dataRouterContext) return null
  return <DataRouterPopGuard when={when} />
}
