import { CUT_KINDS } from '../lib/cuts'
import type { Cuts } from '../lib/cuts'

const LABEL: Record<keyof Cuts, string> = {
  nav: 'nav',
  header: 'header',
  footer: 'footer',
  aside: 'sidebars',
  ads: 'ads',
  scripts: 'scripts',
  iframes: 'embeds',
  forms: 'forms',
}

/** the proofreader's delete mark: a stroke through, ending in a loop */
function Dele() {
  return (
    <svg className="dele" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 12.5 9.5 4c1.3-1.4 3.6-.6 3.4 1.2-.2 1.6-2.4 2-3.2.7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface StripStats {
  status?: number
  finalUrl?: string
  words: number
  minutes: number
  tokens: number
  elapsedMs?: number
}

const fmt = new Intl.NumberFormat('en-US')

export function CutStrip({ stats, cuts }: { stats: StripStats; cuts: Cuts | null }) {
  const kept = cuts ? CUT_KINDS.filter((k) => cuts[k] > 0) : []
  return (
    <div className="strip">
      <dl className="strip-stats">
        {stats.status !== undefined && (
          <div className="stat">
            <dt className="sr-only">Status</dt>
            <dd className="chip chip-status">{stats.status}</dd>
          </div>
        )}
        {stats.finalUrl && (
          <div className="stat stat-url">
            <dt className="sr-only">Final address</dt>
            <dd>
              <a className="final-url" href={stats.finalUrl} target="_blank" rel="noopener noreferrer" title={stats.finalUrl}>
                {stats.finalUrl.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </div>
        )}
        <div className="stat">
          <dt className="sr-only">Words</dt>
          <dd>{fmt.format(stats.words)} words</dd>
        </div>
        <div className="stat">
          <dt className="sr-only">Reading time</dt>
          <dd>{stats.minutes} min read</dd>
        </div>
        <div className="stat">
          <dt className="sr-only">Token estimate</dt>
          <dd title="An estimate: about four characters a token, the rough rate for English with most chat models">~{fmt.format(stats.tokens)} tokens</dd>
        </div>
        {stats.elapsedMs !== undefined && (
          <div className="stat">
            <dt className="sr-only">Fetch time</dt>
            <dd>{fmt.format(stats.elapsedMs)} ms</dd>
          </div>
        )}
      </dl>
      {cuts && (
        <div className="cuts">
          <span className="cuts-label">{kept.length ? 'Cut' : 'Nothing to cut'}</span>
          <ul className="cut-list" aria-label="Page chrome cut from the article">
            {kept.map((k) => (
              <li key={k} className="chip chip-cut">
                <Dele />
                {LABEL[k]} {cuts[k]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
