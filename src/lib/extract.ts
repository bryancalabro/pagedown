// turns a whole html page into its main article: counts the page chrome that gets cut,
// makes every link and image absolute, then lets mozilla readability pick the article.
// the parser is passed in, so the same code runs on the server (jsdom) and in the
// browser (DOMParser) for pasted html.
import { Readability } from '@mozilla/readability'
import type { Cuts } from './cuts.js'

export type { Cuts } from './cuts.js'

export type Parse = (html: string) => Document

export interface Article {
  title: string
  byline: string
  siteName: string
  lang: string
  excerpt: string
  /** the article's html, with absolute urls; turned into markdown by markdown.ts */
  html: string
  cuts: Cuts
}

// common ad containers; a count, not a promise that every ad on the web matches
const AD_SELECTOR = [
  'ins.adsbygoogle',
  '[id^="ad-"]',
  '[id^="ad_"]',
  '[class*="ad-slot"]',
  '[class*="advert"]',
  '[class~="ad"]',
  '[class~="ads"]',
  '[class*="sponsor"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
].join(',')

const count = (doc: Document, selector: string) => doc.querySelectorAll(selector).length

/** how much page chrome the document carries before readability strips it */
export function countCuts(doc: Document): Cuts {
  // an ad inside an ad container counts once
  const ads = Array.from(doc.querySelectorAll(AD_SELECTOR)).filter((el) => !el.parentElement?.closest(AD_SELECTOR)).length
  return {
    nav: count(doc, 'nav, [role="navigation"]'),
    header: count(doc, 'body header, [role="banner"]') - count(doc, 'article header'),
    footer: count(doc, 'body footer, [role="contentinfo"]') - count(doc, 'article footer'),
    aside: count(doc, 'aside, [role="complementary"]'),
    ads,
    scripts: count(doc, 'script, noscript'),
    iframes: count(doc, 'iframe'),
    forms: count(doc, 'form'),
  }
}

/** resolve against a base, or null for anything that is not a real http(s) or mailto target */
export function absolute(href: string | null, base: string): string | null {
  if (!href) return null
  const raw = href.trim()
  if (!raw || raw.startsWith('#')) return raw || null
  try {
    const u = new URL(raw, base)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' ? u.href : null
  } catch {
    return null
  }
}

/** the url a page's own <base href> points at, or the page url itself */
function baseOf(doc: Document, pageUrl: string): string {
  const b = doc.querySelector('base[href]')?.getAttribute('href')
  return absolute(b ?? null, pageUrl) ?? pageUrl
}

function absolutize(doc: Document, pageUrl: string) {
  const base = baseOf(doc, pageUrl)
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = absolute(a.getAttribute('href'), base)
    if (href) a.setAttribute('href', href)
    else a.removeAttribute('href')
  }
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    // lazy loaders keep the real source in a data attribute
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
    const abs = absolute(src, base)
    if (abs && !abs.startsWith('mailto:')) img.setAttribute('src', abs)
    else img.remove()
    img.removeAttribute('srcset')
  }
  // readability drops class names, so carry a code block's language in a data attribute
  for (const code of Array.from(doc.querySelectorAll('pre code, pre'))) {
    const m = /(?:^|\s)(?:language|lang)-([\w+#-]+)/.exec(code.getAttribute('class') ?? '')
    const pre = code.closest('pre')
    if (m && pre && !pre.getAttribute('data-lang')) pre.setAttribute('data-lang', m[1])
  }
}

const meta = (doc: Document, ...names: string[]) => {
  for (const n of names) {
    const v = doc.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content')?.trim()
    if (v) return v
  }
  return ''
}

/** below this many characters of text, what readability found is a menu, not an article */
export const MIN_TEXT = 120

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** the main article of a page, or null when readability finds nothing worth reading */
export function extract(html: string, pageUrl: string, parse: Parse): Article | null {
  const doc = parse(html)
  const cuts = countCuts(doc)
  absolutize(doc, pageUrl)
  const lang = doc.documentElement?.getAttribute('lang') ?? ''
  const siteName = meta(doc, 'og:site_name', 'application-name')
  const parsed = new Readability(doc, { charThreshold: 200 }).parse()
  if (!parsed?.content || clean(parsed.textContent).length < MIN_TEXT) return null
  return {
    title: clean(parsed.title) || clean(meta(doc, 'og:title')) || new URL(pageUrl).hostname,
    byline: clean(parsed.byline).replace(/^by\s+/i, ''),
    siteName: clean(parsed.siteName) || siteName,
    lang: clean(parsed.lang) || lang,
    excerpt: clean(parsed.excerpt),
    html: parsed.content,
    cuts,
  }
}
