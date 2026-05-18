import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const editorCssPath = path.resolve(__dirname, '../src/styles/editor.css')

describe('DocEditorPage scale', () => {
  it('keeps the doc editor workspace at full available width without page-level zoom', () => {
    const styles = fs.readFileSync(editorCssPath, 'utf8')

    expect(styles).toMatch(/\.doc-editor-page\s*\{[\s\S]*width:\s*100%;/)
    expect(styles).not.toMatch(/\.doc-editor-page\s*\{[\s\S]*zoom:\s*var\(--doc-editor-ui-scale\);/)
    expect(styles).not.toMatch(/\.doc-editor-page\s*\{[\s\S]*width:\s*calc\(100%\s*\/\s*var\(--doc-editor-ui-scale\)\);/)
  })
})
