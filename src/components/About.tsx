import { useState } from 'react'
import Dialog from './Dialog'

// the about button sits left of the theme control and opens one modal that says what the app is
export function About() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="theme-button" aria-label="About Pagedown" title="About Pagedown" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="7.9" r="1.1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <Dialog title="About Pagedown" description="Any web page, back as clean Markdown." onClose={() => setOpen(false)}>
          <div className="about">
            <p>
              Paste a link and Pagedown writes the page's article out as GitHub-flavored Markdown. Page chrome like menus and footers gets cut, and the strip above the output counts what went.
            </p>
            <h3>How it works</h3>
            <p>
              A function on this site downloads the page, Mozilla Readability picks the article, and Turndown turns it into Markdown in your browser. Links and images point at their full addresses, and
              tracking parameters come off if you leave that option on.
            </p>
            <h3>Pages behind a login</h3>
            <p>Switch to Paste HTML and paste the page source. That conversion runs in your browser, and the HTML is never sent anywhere.</p>
            <h3>What it keeps</h3>
            <p>Your settings and a short list of recent links stay in this browser. Article text is never stored.</p>
            <h3>Limits</h3>
            <p>
              Public http and https pages only, up to 5 MB and 10 seconds. Private and local addresses are refused. A page that builds its text with JavaScript can come back thin; paste its HTML
              instead.
            </p>
          </div>
        </Dialog>
      )}
    </>
  )
}
