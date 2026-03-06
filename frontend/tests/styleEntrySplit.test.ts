import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('style entry split', () => {
  it('loads the redesign stylesheets instead of the legacy single stylesheet', () => {
    const source = readFileSync(resolve(__dirname, '../src/main.tsx'), 'utf-8')

    expect(source).toContain("./styles/tokens.css")
    expect(source).toContain("./styles/app-shell.css")
    expect(source).toContain("./styles/pages.css")
    expect(source).toContain("./styles/editor.css")
    expect(source).not.toContain("./styles.css")
  })
})
