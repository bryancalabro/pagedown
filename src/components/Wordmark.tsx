export function Wordmark() {
  return (
    <a href="/" className="wordmark" aria-label="Pagedown, home">
      {/* the fetch arrow: a red down caret, the page coming down as markdown */}
      <svg className="wordmark-caret" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 5.5 8 10.5 13 5.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Pagedown
    </a>
  )
}
