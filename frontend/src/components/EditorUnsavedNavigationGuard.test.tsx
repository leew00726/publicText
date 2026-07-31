import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  EditorUnsavedNavigationGuard,
  shouldBlockUnsavedEditorNavigation,
} from './EditorUnsavedNavigationGuard'

describe('EditorUnsavedNavigationGuard', () => {
  it('does not crash legacy MemoryRouter and SSR tests', () => {
    expect(() =>
      renderToStaticMarkup(
        <MemoryRouter>
          <EditorUnsavedNavigationGuard when />
        </MemoryRouter>,
      ),
    ).not.toThrow()
  })

  it('blocks actual Data Router history back and forward transitions while dirty', async () => {
    const router = createMemoryRouter([{ path: '*', element: <div /> }], {
      initialEntries: ['/before', '/editor', '/after'],
      initialIndex: 1,
    })
    router.getBlocker('editor-unsaved-test', ({ historyAction }) =>
      shouldBlockUnsavedEditorNavigation(true, historyAction),
    )

    await router.navigate(-1)
    expect(router.state.location.pathname).toBe('/editor')
    const backBlocker = router.state.blockers.get('editor-unsaved-test')
    expect(backBlocker?.state).toBe('blocked')
    if (backBlocker?.state === 'blocked') backBlocker.reset()

    await router.navigate(1)
    expect(router.state.location.pathname).toBe('/editor')
    const forwardBlocker = router.state.blockers.get('editor-unsaved-test')
    expect(forwardBlocker?.state).toBe('blocked')
    if (forwardBlocker?.state !== 'blocked') throw new Error('Expected forward navigation to be blocked')
    expect(forwardBlocker.location.pathname).toBe('/after')
    forwardBlocker.reset()
    router.dispose()
  })

  it('uses a Data Router in production and mounts the guard in the editor', () => {
    const mainSource = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8')
    const editorSource = readFileSync(resolve(__dirname, '../pages/DocEditorPage.tsx'), 'utf8')
    expect(mainSource).toContain('createBrowserRouter')
    expect(mainSource).toContain('<RouterProvider router={router} />')
    expect(editorSource).toContain('<EditorUnsavedNavigationGuard when={dirty} />')
  })
})
