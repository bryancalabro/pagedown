import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { CutStrip } from './components/CutStrip'
import { EmptyState } from './components/EmptyState'
import { Footer } from './components/Footer'
import { RecentList } from './components/RecentList'
import { Switch } from './components/Switch'
import { ThemeToggle } from './components/ThemeToggle'
import { Wordmark } from './components/Wordmark'
import { fetchArticle } from './lib/api'
import { compose, countWords, estimateTokens, readingMinutes } from './lib/compose'
import type { Cuts } from './lib/cuts'
import { INPUT_MESSAGES, errorMessage } from './lib/messages'
import type { ErrorCode } from './lib/messages'
import { remember } from './lib/recent'
import { load, save } from './lib/store'
import type { Options, Recent } from './lib/store'
import { withoutStyles } from './lib/paste'
import { normalizeUrl, slugify } from './lib/url'

// the preview (marked, DOMPurify) and the converters (turndown, readability) are lazy chunks:
// first paint needs none of them
const Preview = lazy(() => import('./components/Preview'))
type MarkdownModule = typeof import('./lib/markdown')

type Mode = 'link' | 'paste'
type View = 'raw' | 'preview'

interface Doc {
  title: string
  byline: string
  url: string
  finalUrl?: string
  status?: number
  elapsedMs?: number
  fetchedAt: string
  html: string
  cuts: Cuts
  note?: string
}

type Failure = { code: ErrorCode; status?: number }

/** the ?url= a shared link carries, read once at start */
function linkFromAddress(): string {
  try {
    const u = new URLSearchParams(window.location.search).get('url')
    if (!u) return ''
    const n = normalizeUrl(u)
    return n.ok ? n.url : ''
  } catch {
    return ''
  }
}

const PASTE_BASE = 'https://pagedown.invalid/'


export default function App() {
  const [initialLink] = useState(linkFromAddress)
  const [mode, setMode] = useState<Mode>('link')
  const [input, setInput] = useState(initialLink)
  const [inputNote, setInputNote] = useState('')
  const [pasteHtml, setPasteHtml] = useState('')
  const [pasteBase, setPasteBase] = useState('')
  const [options, setOptions] = useState<Options>(() => load().options)
  const [recent, setRecent] = useState<Recent[]>(() => load().recent)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [md, setMd] = useState<MarkdownModule | null>(null)
  const [view, setView] = useState<View>('raw')
  const [flash, setFlash] = useState('')
  const inflight = useRef<AbortController | null>(null)
  const outputRef = useRef<HTMLElement>(null)
  const flashTimer = useRef<number | undefined>(undefined)

  const body = useMemo(() => (md && doc ? md.toMarkdown(doc.html, options) : ''), [md, doc, options])
  const markdown = useMemo(
    () => (doc ? compose(body, { title: doc.title, byline: doc.byline, url: doc.finalUrl ?? doc.url, fetchedAt: doc.fetchedAt }, options.frontMatter) : ''),
    [body, doc, options.frontMatter],
  )
  const words = useMemo(() => countWords(markdown), [markdown])

  const say = (text: string) => {
    window.clearTimeout(flashTimer.current)
    setFlash(text)
    flashTimer.current = window.setTimeout(() => setFlash(''), 2200)
  }

  const persist = (patch: Partial<{ options: Options; recent: Recent[] }>) => save({ ...load(), ...patch })

  const updateOption = (key: keyof Options, value: boolean) => {
    const next = { ...options, [key]: value }
    setOptions(next)
    persist({ options: next })
  }

  const showOutput = () => {
    // on a phone the output sits below the form; bring it up once there is something to read
    if (window.matchMedia('(max-width: 899px)').matches) outputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  async function run(url: string) {
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    setBusy(true)
    setFailure(null)
    try {
      // start loading the converter while the page downloads; a failure answers first
      const converter = md ? Promise.resolve(md) : import('./lib/markdown')
      converter.catch(() => undefined)
      const result = await fetchArticle(url, controller.signal)
      if (controller.signal.aborted) return
      if (!result.ok) {
        setFailure({ code: result.code, status: result.status })
        setDoc(null)
        return
      }
      let mod: MarkdownModule
      try {
        mod = await converter
      } catch {
        setFailure({ code: navigator.onLine === false ? 'offline' : 'server' })
        setDoc(null)
        return
      }
      if (controller.signal.aborted) return
      setMd(mod)
      setDoc({ title: result.title, byline: result.byline, url: result.url, finalUrl: result.finalUrl, status: result.status, elapsedMs: result.elapsedMs, fetchedAt: result.fetchedAt, html: result.html, cuts: result.cuts })
      const at = Date.now()
      setNow(at)
      const nextRecent = remember(recent, { url: result.url, title: result.title, at })
      setRecent(nextRecent)
      persist({ recent: nextRecent })
      window.history.replaceState(null, '', `/?url=${encodeURIComponent(result.url)}`)
      showOutput()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setFailure({ code: 'server' })
    } finally {
      if (inflight.current === controller) setBusy(false)
    }
  }

  const submitLink = (raw: string) => {
    const n = normalizeUrl(raw)
    if (!n.ok) {
      setInputNote(INPUT_MESSAGES[n.reason])
      return
    }
    setInputNote('')
    setInput(n.url)
    void run(n.url)
  }

  async function convertPaste() {
    if (!pasteHtml.trim()) {
      setInputNote(INPUT_MESSAGES.pasteEmpty)
      return
    }
    setInputNote('')
    setFailure(null)
    setBusy(true)
    try {
      const [{ extract, countCuts }, mod] = await Promise.all([import('./lib/extract'), md ?? import('./lib/markdown')])
      setMd(mod)
      // the app's CSP refuses inline styles even in a parsed document, and the converter needs none
      const parse = (h: string) => new DOMParser().parseFromString(withoutStyles(h), 'text/html')
      const probe = parse(pasteHtml)
      const declared = probe.querySelector('link[rel="canonical"]')?.getAttribute('href') || probe.querySelector('meta[property="og:url"]')?.getAttribute('content') || ''
      const base = normalizeUrl(pasteBase).ok ? (normalizeUrl(pasteBase) as { url: string }).url : normalizeUrl(declared).ok ? (normalizeUrl(declared) as { url: string }).url : ''
      const pageUrl = base || PASTE_BASE
      const article = extract(pasteHtml, pageUrl, parse)
      // a fragment with no article in it is still worth converting whole
      const whole = !article
      const html = (article?.html ?? probe.body?.innerHTML ?? '').split(PASTE_BASE).join('/')
      const title = article?.title && article.title !== 'pagedown.invalid' ? article.title : probe.title.trim() || 'Pasted page'
      setDoc({
        title,
        byline: article?.byline ?? '',
        url: base || '',
        fetchedAt: new Date().toISOString(),
        html,
        cuts: article?.cuts ?? countCuts(probe),
        note: whole ? 'No article was found in the paste, so all of it was converted.' : undefined,
      })
      showOutput()
    } finally {
      setBusy(false)
    }
  }

  // a shared ?url= link fetches as soon as the page opens
  useEffect(() => {
    if (!initialLink) return
    const t = window.setTimeout(() => void run(initialLink), 0)
    return () => window.clearTimeout(t)
    // run once, for the address the page opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLink])

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      say(done)
    } catch {
      say('Copy failed. Select the text and copy it by hand.')
    }
  }

  const download = () => {
    if (!doc) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `${slugify(doc.title)}.md`
    document.body.append(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const shareUrl = doc?.url && doc.status !== undefined ? `${window.location.origin}/?url=${encodeURIComponent(doc.url)}` : ''
  const announce = busy ? 'Fetching the page.' : failure ? errorMessage(failure.code, failure.status) : doc ? `${doc.title}. ${words} words.` : ''

  return (
    <div className="page">
      <header className="site-header">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="main instrument">
        <section className="pane input-pane" aria-label="Source">
          <div className="segmented" role="group" aria-label="Source">
            <button type="button" className="segment" aria-pressed={mode === 'link'} onClick={() => { setMode('link'); setInputNote('') }}>
              Link
            </button>
            <button type="button" className="segment" aria-pressed={mode === 'paste'} onClick={() => { setMode('paste'); setInputNote('') }}>
              Paste HTML
            </button>
          </div>

          {mode === 'link' ? (
            <form
              className="fetch-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                submitLink(input)
              }}
            >
              <label htmlFor="url" className="field-label">
                Page link
              </label>
              <div className="url-row">
                <div className="url-field">
                  <svg className="url-glyph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    id="url"
                    className="input url-input"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="example.com/article"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    aria-describedby="input-note"
                  />
                </div>
                <button type="submit" className="button button-primary" aria-busy={busy}>
                  {busy ? 'Fetching' : 'Fetch'}
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M3 5.5 8 10.5 13 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </form>
          ) : (
            <form
              className="fetch-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void convertPaste()
              }}
            >
              <label htmlFor="paste" className="field-label">
                Page HTML
              </label>
              <textarea
                id="paste"
                className="input textarea"
                spellCheck={false}
                placeholder="Open the page, view its source, and paste all of it here."
                value={pasteHtml}
                onChange={(e) => setPasteHtml(e.target.value)}
                aria-describedby="input-note paste-note"
              />
              <label htmlFor="paste-base" className="field-label">
                Page address <span className="field-optional">(optional, for its links)</span>
              </label>
              <input
                id="paste-base"
                className="input"
                type="text"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="example.com/article"
                value={pasteBase}
                onChange={(e) => setPasteBase(e.target.value)}
              />
              <p id="paste-note" className="field-note">
                Converted in this browser. The HTML is never sent anywhere.
              </p>
              <button type="submit" className="button button-primary convert-button">
                Convert
              </button>
            </form>
          )}
          <p id="input-note" className="input-note" role="alert">
            {inputNote}
          </p>

          <fieldset className="options">
            <legend className="section-title">Options</legend>
            <Switch label="Images" note="Keep image links" checked={options.images} onChange={(v) => updateOption('images', v)} />
            <Switch label="Reference links" note="Numbered links at the end" checked={options.referenceLinks} onChange={(v) => updateOption('referenceLinks', v)} />
            <Switch label="Strip tracking" note="Drop utm, fbclid and similar" checked={options.stripTracking} onChange={(v) => updateOption('stripTracking', v)} />
            <Switch label="Front matter" note="Title, source, byline, date" checked={options.frontMatter} onChange={(v) => updateOption('frontMatter', v)} />
          </fieldset>

          <RecentList
            items={recent}
            now={now}
            onPick={(url) => {
              setMode('link')
              setInput(url)
              setInputNote('')
              void run(url)
            }}
            onClear={() => {
              setRecent([])
              persist({ recent: [] })
            }}
          />
        </section>

        <section className="pane output-pane" aria-label="Markdown" ref={outputRef}>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          {busy && !doc ? (
            <div className="output-state" aria-hidden="true">
              <p className="state-title">Fetching</p>
              <div className="skeleton" />
              <div className="skeleton skeleton-short" />
              <div className="skeleton" />
            </div>
          ) : failure ? (
            <div className="output-state">
              <p className="state-title">Nothing came back</p>
              <p className="state-error" data-code={failure.code}>
                {errorMessage(failure.code, failure.status)}
              </p>
            </div>
          ) : doc ? (
            <div className="doc" aria-busy={busy}>
              <h2 className="doc-title">{doc.title}</h2>
              {doc.byline && <p className="doc-byline">{doc.byline}</p>}
              <CutStrip
                stats={{ status: doc.status, finalUrl: doc.finalUrl, words, minutes: readingMinutes(words), tokens: estimateTokens(markdown), elapsedMs: doc.elapsedMs }}
                cuts={doc.cuts}
              />
              {doc.note && <p className="doc-note">{doc.note}</p>}
              <div className="toolbar">
                <div className="segmented segmented-small" role="group" aria-label="View">
                  <button type="button" className="segment" aria-pressed={view === 'raw'} onClick={() => setView('raw')}>
                    Raw
                  </button>
                  <button type="button" className="segment" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>
                    Preview
                  </button>
                </div>
                <div className="toolbar-actions">
                  <button type="button" className="button button-quiet" onClick={() => void copy(markdown, 'Copied')}>
                    {flash === 'Copied' ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" className="button button-quiet" onClick={download}>
                    Download
                  </button>
                  {shareUrl && (
                    <button type="button" className="button button-quiet" onClick={() => void copy(shareUrl, 'Link copied')}>
                      {flash === 'Link copied' ? 'Link copied' : 'Share link'}
                    </button>
                  )}
                </div>
              </div>
              <p className="flash" role="status">
                {flash && flash !== 'Copied' && flash !== 'Link copied' ? flash : ''}
              </p>
              {view === 'raw' ? (
                <pre className="markdown" tabIndex={0} aria-label="Markdown">
                  {markdown}
                </pre>
              ) : (
                <Suspense fallback={<p className="state-title">Rendering</p>}>
                  <Preview markdown={markdown} />
                </Suspense>
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
