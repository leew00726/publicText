import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const editorCssPath = path.resolve(__dirname, '../src/styles/editor.css')

describe('DocEditorPage scale', () => {
  it('applies a 20 percent page-level scale to the doc editor workspace', () => {
    const styles = fs.readFileSync(editorCssPath, 'utf8')

    expect(styles).toMatch(/\.doc-editor-page\s*\{[\s\S]*--doc-editor-ui-scale:\s*1\.2;/)
    expect(styles).toMatch(/\.doc-editor-page\s*\{[\s\S]*zoom:\s*var\(--doc-editor-ui-scale\);/)
    expect(styles).toMatch(/\.doc-editor-page\s*\{[\s\S]*width:\s*calc\(100%\s*\/\s*var\(--doc-editor-ui-scale\)\);/)
  })
})
