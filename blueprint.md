# Pagedown blueprint

Derived from the catalog record [`pagedown`](https://github.com/bryancalabro/calabrodesign/blob/main/specs/app-inventory/pagedown.md) on 2026-10-14.
The record is the source of truth for the name, host, description and tokens; this document is the source of truth for what "done" means.

## 0. Header

| Field | Value |
| --- | --- |
| App | pagedown |
| Host | https://pagedown.bryancalabro.com |
| Family | Instrument |
| Stack | React + Tailwind + Vite, one same-origin Vercel function (`api/fetch`) running Mozilla Readability and Turndown |
| Derived | 2026-10-14 |

## 1. Product

Build **Pagedown**: paste a URL and get the page's main content back as clean Markdown, with navigation, ads, and page chrome removed.

Meta description, verbatim from the record and not rewritten here: Fetches any public web page and returns its main article as clean Markdown, with navigation, ads, and page chrome stripped and source links kept.

## 2. Current state

Greenfield. The scaffold carries the house rules and nothing else; every feature below is unbuilt.

## 3. Research

No source. Basis: the catalog record.

## 4. Non-goals

The house default-off list: accounts, feeds, CMS, social, recommendation engines, analytics suites, and backends. Including one needs a justification here and a logged decision in section 10.

## 5. Design rules

Family Instrument fixes the layout. The look was designed for this app alone (`/new-app` step 2b): palette, type pair, density, surface strategy, radius and the wordmark treatment come from the record, not from taste or from the last app.

- Palette: bg #171C2B, surface #1F2536, ink #EEF0F6, muted #A3A9BA, accent #FF3B5C, accent-ink #171C2B (light: bg #F4F2EE, surface #FFFFFF, ink #161A26, muted #565D6E, accent #C8173A, accent-ink #FFFFFF)
- Type pair: Hedvig Letters Serif / Fragment Mono
- Density: tight | Surface strategy: flat panes on one dark ground split by a 1px hairline; the output pane sits one step lighter, no shadows | Radius: 10px panes, 8px controls, 999px status chips
- Identity: wordmark: Pagedown | treatment: display serif at its one regular weight, sentence case, led by a red down caret (the fetch arrow)
- Look: roll: Readwise Reader's editorial reading calm x high-contrast dark mode with one saturated accent | refs: Exa crawling playground, URL input left and a dark results pane with a JSON/Visual toggle, response time and copy (https://mobbin.com/screens/6a2b0081-e92e-4099-a9ee-cba1776617f6); Firecrawl playground, one URL field with an https:// prefix, one primary action and a recent-runs list with status (https://mobbin.com/screens/c2692c1d-b796-4ff8-9123-ced1361e64f5); Google Gemini research reader, a dark reading pane with a calm measure and a quiet export row (https://mobbin.com/screens/e200f2a4-f38a-4882-b92d-422e6628f10e); Kindle sample reader, serif body at a book measure with one thin progress rule (https://mobbin.com/screens/374186a9-1431-4480-8386-7c40754f5959); a copy editor's red proofreading pencil and its delete mark on galley proofs | direction: an ink-navy reading desk where the converted page reads like a galley proof, with one saturated proofreader's red reserved for the fetch action, the stripped-chrome count and focus | signature: a strip above the output that counts what was cut (nav, footer, ads, scripts) beside status, final URL, words and tokens, the proofreader's delete mark beside each count
- Footer is one link to `https://bryancalabro.com` reading `© {year} Bryan J. Calabro - v{version}`, with no hover styling.
- Sentence case everywhere. No em dashes. Light and dark both measured against 4.5:1.

## 6. Feature backlog

Field order is identical in every block: ID, status, phase, problem, user-visible behavior, source, implementation notes, dependencies, commit unit, acceptance checks, verification, completed, out of scope.

Every acceptance check below is an action in the running app (or a command) plus the exact observation that proves it; `blueprint-from-record.mjs --check` passed on them before the first build commit.

---

### PAG-001: URL field with one Fetch action

**Status:** planned
**Phase:** Phase 1: Core

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** URL field with one Fetch action; a bare domain gets `https://`, and anything that is not http or https is refused before a request is made

**Source:** Mobbin: Firecrawl playground URL field with an https:// prefix and one primary action (https://mobbin.com/screens/c2692c1d-b796-4ff8-9123-ced1361e64f5)

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Type `example.com/post` into the URL field and press Enter: the field now reads `https://example.com/post` and exactly one request goes to `/api/fetch?url=https%3A%2F%2Fexample.com%2Fpost`.
- AC-2: Type `ftp://example.com/file` and press Fetch: the message `Only http and https links can be fetched.` appears under the field and no request reaches `/api/`.
- AC-3: Clear the field and press Fetch: the message `Paste a link to fetch.` appears and no request reaches `/api/`.

**Verification:**
- AC-1: pending
- AC-2: pending
- AC-3: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-002: The function fetches server-side and refuses private, loopback, and...

**Status:** planned
**Phase:** Phase 1: Core

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** **The function fetches server-side and refuses private, loopback, and link-local addresses on every redirect hop**, caps the body at 5 MB and the wait at 10 seconds, and accepts only HTML responses

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Unit: the address guard refuses `127.0.0.1`, `10.0.0.1`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254`, `100.64.0.1`, `0.0.0.0`, `::1`, `fc00::1`, `fe80::1` and `::ffff:127.0.0.1`, and allows `93.184.215.14` and `2606:2800:21f:cb07:6820:80da:af6b:8b2c`.
- AC-2: Unit: a public host that answers 302 to `http://169.254.169.254/latest/meta-data/` ends with the error code `blocked`, and the second hop is never connected.
- AC-3: Unit: a body past 5 MB ends with `too-large`, an answer slower than 10 seconds ends with `timeout`, and `Content-Type: application/pdf` ends with `not-html`.
- AC-4: Unit: the handler answers 400 for a request with no `url`, with a non-http scheme, or with any query parameter other than `url`; a success carries `Cache-Control` with `s-maxage`, `stale-while-revalidate` and `stale-if-error`, and an upstream failure carries `no-store`.

**Verification:**
- AC-1: pending
- AC-2: pending
- AC-3: pending
- AC-4: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-003: Readability picks the main article and Turndown writes...

**Status:** planned
**Phase:** Phase 1: Core

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Readability picks the main article and Turndown writes GitHub-flavored Markdown: ATX headings, fenced code, tables, and absolute link and image URLs

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Unit: the fixture article page (nav, sidebar, footer, an `h2`, a `pre code.language-js`, a two-column table, a relative link and a relative image) converts to Markdown holding `## `, a ```` ```js ```` fence, a `| --- |` table row, `https://example.com/guide/next` and `https://example.com/img/fig.png`, and none of the nav, sidebar or footer text.
- AC-2: Unit: the same fixture reports the cut counts: at least one nav, one footer, one aside and every script removed.

**Verification:**
- AC-1: pending
- AC-2: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-004: The output pane shows the Markdown under a strip with the status...

**Status:** planned
**Phase:** Phase 1: Core

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** The output pane shows the Markdown under a strip with the status code, the final URL after redirects, the word count, and reading time

**Source:** Mobbin: Exa crawling result header with response time (https://mobbin.com/screens/6a2b0081-e92e-4099-a9ee-cba1776617f6); Postman response status (https://mobbin.com/screens/bd625124-493c-4504-b10b-67f63885ecf2)

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: After a fetch of the article fixture, the strip above the output shows the status chip `200`, the final URL after redirects, `N words`, `N min read` and the time the fetch took in ms, where N matches the word count the converter returns.
- AC-2: The strip shows one chip per cut kind with a count (`nav 1`, `footer 1`, `aside 1`, `scripts 3` for the fixture), each led by the delete mark.

**Verification:**
- AC-1: pending
- AC-2: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-005: Toggle between raw Markdown and a rendered preview of it

**Status:** planned
**Phase:** Phase 1: Core

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Toggle between raw Markdown and a rendered preview of it

**Source:** Mobbin: Exa JSON/Visual toggle (https://mobbin.com/screens/6a2b0081-e92e-4099-a9ee-cba1776617f6)

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: After a fetch, the output shows raw Markdown starting with `# ` and the article title; press Preview and the pane shows an `h1` with that title and no `#` character before it; press Raw and the Markdown is back.
- AC-2: In Preview, an image renders as a labeled placeholder with its alt text and a link to the image URL, and no request leaves for a third-party image host.

**Verification:**
- AC-1: pending
- AC-2: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-006: Copy, or download as <slug>.md, with optional YAML front matter...

**Status:** planned
**Phase:** Phase 2: Core (continued)

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Copy, or download as `<slug>.md`, with optional YAML front matter (title, source URL, byline, fetched date)

**Source:** Mobbin: Obvious Markdown export with one Copy button (https://mobbin.com/screens/f23f64e0-06af-416c-b90c-432b06144af5)

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Press Copy: the clipboard holds the exact Markdown in the raw pane and the button reads `Copied` for about two seconds.
- AC-2: Press Download: a file named after the title slug with `.md` downloads, for the fixture `field-notes-on-quiet-software.md`, and its text equals the raw pane.
- AC-3: Turn on Front matter: the Markdown starts with `---`, then `title:`, `source:`, `byline:` and `fetched:` lines (the date as YYYY-MM-DD), then `---`; turn it off and they are gone.

**Verification:**
- AC-1: pending
- AC-2: pending
- AC-3: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-007: Paste-HTML mode converts raw HTML in the browser, so a page behind a...

**Status:** planned
**Phase:** Phase 2: Core (continued)

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Paste-HTML mode converts raw HTML in the browser, so a page behind a login converts without the server ever seeing it

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Switch to Paste HTML, paste the article fixture's HTML with a base URL of `https://example.com/guide/`, press Convert: the Markdown appears with the same headings as the server conversion and absolute links, and no request reaches `/api/`.

**Verification:**
- AC-1: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-008: One specific message for each failure

**Status:** planned
**Phase:** Phase 2: Core (continued)

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** One specific message for each failure: blocked address, timeout, not HTML, too large, an upstream 4xx or 5xx, and no readable article found

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: For each error code the function can return (`blocked`, `timeout`, `not-html`, `too-large`, `upstream`, `no-article`, `bad-url`, `dns`), the output pane shows its own message naming the problem and what to try, and no two codes share a message.
- AC-2: With the network offline, pressing Fetch shows `You are offline. Paste the page's HTML instead, or try again when you are back online.`

**Verification:**
- AC-1: pending
- AC-2: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-009: Recent fetches (URL, title, time) are kept in localStorage

**Status:** planned
**Phase:** Phase 2: Core (continued)

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Recent fetches (URL, title, time) are kept in localStorage; page bodies never are

**Source:** Mobbin: Firecrawl recent runs list (https://mobbin.com/screens/c2692c1d-b796-4ff8-9123-ced1361e64f5)

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: After a fetch, reload the page: the Recent list shows the article's title, its host and a relative time, and pressing it fills the field and fetches again.
- AC-2: The stored value under `bc:pagedown.bryancalabro.com` holds the URL, title and time of each recent fetch and none of the article's Markdown text; Clear empties the list.

**Verification:**
- AC-1: pending
- AC-2: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-010: Options to drop images, write links reference-style, and strip...

**Status:** planned
**Phase:** Phase 3: Bolster

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** Options to drop images, write links reference-style, and strip tracking parameters from every link

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Turn off Images: the Markdown holds no `![`. Turn on Reference links: inline `](https://` links are gone and numbered `[1]: https://` definitions sit at the end. With Strip tracking on, a fixture link carrying `utm_source`, `fbclid` and `gclid` comes out without them and keeps its other parameters.

**Verification:**
- AC-1: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-011: A ?url= deep link that fetches on load, so a conversion can be shared

**Status:** planned
**Phase:** Phase 3: Bolster

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** A `?url=` deep link that fetches on load, so a conversion can be shared

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: Open `/?url=https%3A%2F%2Fexample.com%2Fguide%2F`: the field fills and the fetch runs on load without a press; after any fetch the address bar carries `?url=` for the fetched link, and Share link copies that address.

**Verification:**
- AC-1: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

### PAG-012: A token estimate beside the word count, for pasting into a chat model

**Status:** planned
**Phase:** Phase 3: Bolster

**Problem:** the catalog record asks for this and the app does not do it yet.

**User-visible behavior:** A token estimate beside the word count, for pasting into a chat model

**Source:** No source. Basis: the catalog record.

**Implementation notes:**
- Pure logic in `src/lib/` with a test beside it; components render, they do not compute.
- House rules bind here: sentence case, no em dashes, light and dark tokens, 44px targets, visible focus, `prefers-reduced-motion`.

**Dependencies:** none

**Commit unit:** One commit.

**Acceptance checks:**
- AC-1: After a fetch, the strip shows `~N tokens` where N is the Markdown's length in characters divided by four, rounded up, and the label explains it is an estimate.

**Verification:**
- AC-1: pending

**Completed:**

**Out of scope:** anything not named in the bullet above.

---

## 7. Phases

### Phase 0: Research and spec
**Feature IDs:** none
**Status:** planned. Only `/phase` stamps a phase after its gate passes; the catalog reads a done status followed by the completion date and commit.

### Phase 1: Core
**Feature IDs:** PAG-001, PAG-002, PAG-003, PAG-004, PAG-005
**Status:** planned

### Phase 2: Core (continued)
**Feature IDs:** PAG-006, PAG-007, PAG-008, PAG-009
**Status:** planned

### Phase 3: Bolster
**Feature IDs:** PAG-010, PAG-011, PAG-012
**Status:** planned

### Phase 4: Debt
**Feature IDs:** none yet
**Status:** planned

## 8. Machinery

Gate: `node scripts/verify-phase.mjs --phase N`. Receipt: `.blueprint/receipt.json`, written only when every gate passes, and read by the factory as this record's `Conformance`.

Test approach: pure logic modules under `src/lib/` with Vitest beside them, plus Playwright checks in `e2e/` that drive the running app in headless Chromium (`npm run test:e2e`, the `e2e` gate).

## 9. Execution contract

One phase at a time with `/phase N`. A phase is done only when every feature ID in it carries a filled completion stamp and `learnings.json` has its entry.

## 10. Decisions

| Date | Decision | Rejected alternative |
| --- | --- | --- |
| 2026-10-14 | Split 9 build bullets into 2 Core phase(s) of at most 5 | One Core phase holding every bullet |

## 11. Amendment protocol

Features are append-only. A feature that changes scope gets a new ID and the old one is marked superseded, naming the ID that replaces it.

## 12. Change log and completion ledger

### Change log

- 2026-10-14: Blueprint derived from the record. 12 features across 3 build phase(s).

### Completion ledger

| Feature ID | Date | Commit SHA | Verifier |
| --- | --- | --- | --- |

### Status board

| Phase | Feature IDs | Status |
| --- | --- | --- |
| Phase 0: Research and spec | _(this document)_ | planned |
| Phase 1: Core | PAG-001, PAG-002, PAG-003, PAG-004, PAG-005 | planned |
| Phase 2: Core (continued) | PAG-006, PAG-007, PAG-008, PAG-009 | planned |
| Phase 3: Bolster | PAG-010, PAG-011, PAG-012 | planned |
| Phase 4: Debt | none yet | planned |
