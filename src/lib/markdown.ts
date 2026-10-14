// turns the article html into github-flavored markdown with turndown: atx headings, fenced
// code with its language, gfm tables, and the reader's options for images, link style and
// tracking parameters. runs in the browser (and in node for the tests).
import TurndownService from 'turndown'
import { strikethrough, tables, taskListItems } from 'turndown-plugin-gfm'
import { stripTracking } from './url'

export interface MarkdownOptions {
  images: boolean
  referenceLinks: boolean
  stripTracking: boolean
}

function service(opts: MarkdownOptions) {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: opts.referenceLinks ? 'referenced' : 'inlined',
    linkReferenceStyle: 'full',
  })
  td.use([tables, strikethrough, taskListItems])
  td.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button', 'input', 'select', 'textarea'])

  // a fenced block keeps the language extract.ts carried over as data-lang
  td.addRule('fencedWithLanguage', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const pre = node as HTMLElement
      const lang = pre.getAttribute('data-lang') ?? /(?:language|lang)-([\w+#-]+)/.exec(pre.querySelector('code')?.getAttribute('class') ?? '')?.[1] ?? ''
      const code = (pre.textContent ?? '').replace(/\n$/, '')
      // a fence longer than any backtick run inside the code
      const longest = Math.max(2, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length))
      const fence = '`'.repeat(longest + 1)
      return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`
    },
  })

  // a card link that wraps a heading or paragraphs: link the first line, keep the rest as blocks
  td.addRule('blockLink', {
    filter: (node) => node.nodeName === 'A' && !!node.getAttribute('href') && !!node.querySelector('h1, h2, h3, h4, h5, h6, p, div, ul, ol, figure'),
    replacement: (content, node) => {
      const href = (node as HTMLElement).getAttribute('href')!
      const lines = content.trim().split('\n')
      const i = lines.findIndex((l) => l.trim() && !/^!\[/.test(l.trim()))
      if (i < 0) return content
      const m = /^(#{1,6}\s+)?(.*)$/.exec(lines[i].trim())!
      lines[i] = `${m[1] ?? ''}[${m[2].replace(/[[\]]/g, '\\$&')}](${href})`
      return `\n\n${lines.join('\n')}\n\n`
    },
  })

  if (!opts.images) td.addRule('noImages', { filter: ['img', 'picture', 'figure'], replacement: (content, node) => (node.nodeName === 'FIGURE' ? content : '') })
  else
    td.addRule('figure', {
      filter: 'figcaption',
      replacement: (content) => (content.trim() ? `\n\n_${content.trim()}_\n\n` : ''),
    })

  if (opts.stripTracking) {
    // rewrite hrefs before the link rules read them
    td.addRule('cleanLinks', {
      filter: (node) => {
        if (node.nodeName === 'A' && node.getAttribute('href')) node.setAttribute('href', stripTracking(node.getAttribute('href')!))
        if (node.nodeName === 'IMG' && node.getAttribute('src')) node.setAttribute('src', stripTracking(node.getAttribute('src')!))
        return false
      },
      replacement: () => '',
    })
  }
  return td
}

/** the article's markdown body (no title line, no front matter) */
export function toMarkdown(html: string, opts: MarkdownOptions): string {
  return service(opts)
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
