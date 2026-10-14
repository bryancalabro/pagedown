// the rendered view of the markdown: marked writes html, DOMPurify cleans it, and images
// become labeled links so the preview never loads a third-party image.
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

let hooked = false
function installHooks() {
  if (hooked) return
  hooked = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'img' || !(node instanceof Element)) return
    const src = node.getAttribute('src') ?? ''
    const alt = node.getAttribute('alt')?.trim() || 'Image'
    const link = node.ownerDocument.createElement('a')
    link.className = 'img-placeholder'
    link.textContent = `Image: ${alt}`
    if (/^https?:\/\//.test(src)) link.setAttribute('href', src)
    node.replaceWith(link)
  })
}

export default function Preview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    installHooks()
    const raw = marked.parse(markdown, { async: false, gfm: true }) as string
    return DOMPurify.sanitize(raw, { FORBID_ATTR: ['style'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'] })
  }, [markdown])
  return <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
}
