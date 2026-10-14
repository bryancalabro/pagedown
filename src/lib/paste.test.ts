import { describe, expect, it } from 'vitest'
import { withoutStyles } from './paste'

describe('withoutStyles', () => {
  it('drops style blocks, stylesheet links and style attributes and keeps the text', () => {
    const html = `<link rel="stylesheet" href="/a.css"><style>p{color:red}</style><p style="color: red" class="x">Hi</p><div style='a:b'>There</div><STYLE type="text/css">x{}</STYLE >`
    expect(withoutStyles(html)).toBe('<p class="x">Hi</p><div>There</div>')
  })
})
