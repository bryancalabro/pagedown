## General guidelines

- Never use an em dash. Use a comma, semicolon, parentheses, period, or a plain hyphen.
- Write US English spelling: color, behavior, organization, optimize, analyze, catalog, artifact, judgment, gray, license. Quoted text, proper names, and code identifiers keep their own spelling.
- Never edit CHANGELOG.md or other auto-generated files by hand.
- When making technical decisions, do not overweight development cost. Prefer quality, simplicity, robustness, scalability, and long-term maintainability.
- For bug fixes, reproduce the issue the way a user would before changing code.
- In UI work, treat visual defects as defects. If something looks off, fix it even if it is next to the task, not the task itself.
- Fix lint failures, test failures, and flaky tests when you see them, including ones you did not cause.
- Verify UI in a real browser with Playwright (headless Chromium): load the page, exercise the change, fail on console errors, and take a screenshot when the look matters. A check worth repeating becomes a spec in `e2e/` (`npm run test:e2e`) that runs before every PR. Browser checks add to typecheck, lint, test, and build; they never replace them. In a cloud agent session that ships Chromium (Claude Code's, at `/opt/pw-browsers`), never download browsers.
- Verify facts against primary sources: code, data files, official text. Do not treat transcripts, meetings, or recollection as fact. Those are sources of intent.
- On every ship commit / production PR, bump `package.json` from the repo's current version per the Version bumps rule below. Never jump to a fixed target. Keep footer `v{version}` in sync.

## House rules

Apply across first-party Calabro app repos. Skip upstream and third-party.

### Footer (every app)

Replace any `· Calabro ·`, bare URL, Beta, or other footer chrome with exactly:

`© {currentYear} Bryan J. Calabro - v{packageVersion}`

- `{currentYear}` comes from the user's clock at render (`new Date().getFullYear()` or equivalent). Do not hardcode a year.
- `{packageVersion}` is `package.json` `version`, shown with a leading `v` (example `v0.1.0`).
- The entire footer line (copyright symbol, year, name, hyphen, and version) is one link to `https://bryancalabro.com`. Do not link only the name.
- That link has no hover styling.
- Footer and `package.json` version stay in sync.

### Version bumps (every ship / production PR)

Every ship commit that releases must bump `package.json` from that repo's current version (one increment on the rightmost digit). Never jump to a fixed target like `0.1.2`. Prefer one increment per ship commit; prefer one commit per footer PR. A second bump in the same PR is OK only if a material amend needs a second ship commit.

Scheme: three-part `MAJOR.MINOR.PATCH`. The rightmost component increments `1` through `9`, then rolls over, increments the next component left, and resets the right to `0`. Same rule for every major.

Examples:
- If current is `0.0.1`, bump to `0.0.2`
- `0.0.9` to `0.1.0`
- `0.1.1` to `0.1.2` only when it was already `0.1.1`
- `0.9.9` to `1.0.0`
- `1.0.9` to `1.1.0`, then on to `1.9.9` to `2.0.0`

Write versions as `v0.2.0`, never `v.0.2.0`. Footer must show the new version after the bump.

If the repo has no `package.json`, on first ship create a minimal `package.json` with `"version": "0.0.1"` (plus normal name/private fields as needed). Footer shows `v0.0.1`. Never invent a footer version that is not written to `package.json`. Next ships bump from there.

### Agent rule files

Root `AGENTS.md` is the only real rule file, and every agent reads it. Root `CLAUDE.md` is wiring only: `@AGENTS.md`. Ship both on every greenfield scaffold (the one-line pointer covers Claude Code paths that still need `CLAUDE.md` after native `AGENTS.md` support). Do not mirror a second full copy. Nothing the house runs depends on one agent: commands are Markdown plus zero-dependency node scripts, guards are git hooks, and per-agent folders (`.claude/`, `.cursor/`, `.agents/`) only point at the contract.

### Git

Open PRs. Do not push `main` without approval. Do not delete Vercel projects or domains. Do not create a Vercel project or deploy an app without Bryan's yes for that app: ask up front, and no answer means no (the account is on Hobby, capped at 200 projects).

Greenfield exception: when the remote has no branches yet, push the scaffold commit as `main` first, so `main` becomes the default branch; everything after it goes through a PR (see `/new-app` step 3). On a repo `/new-app` created or found empty, `/new-app` merges that first build PR itself once it is ship-ready (the step 6 gates pass locally, `/ship` has run, and the PR is out of draft), by rebase, at the commit the gates passed on. A repo that has ever merged a PR gets no exception: every later PR waits for Bryan. There is no CI: the gates run locally before every PR, because Actions minutes are one monthly budget across every private repo, so a workflow runs on dispatch or a schedule, never on push or PR (`house-audit` `ci`).

When `/new-app` already shipped the product, the first `/phase` is verify-and-stamp against main, not a rebuild.

### Catalog

The app inventory in calabrodesign is the canonical catalog of every app: name, host, meta description, surface, status, design family, and build prompt. It is `specs/app-inventory.md` (the index) plus one record per app under `specs/app-inventory/`. Read this app's record before renaming it, changing its public URL, or rewriting its meta description, and after a launch or public-facing change stamp that record with `/inventory sync` (a local run of the factory for one record) so completion is stamped from evidence, never by hand. Do not invent a product name, host, or description that is not in the catalog. Portfolio cards on bryancalabro.com match the inventory, not the other way around. Catalog: https://github.com/bryancalabro/calabrodesign/blob/main/specs/app-inventory.md (use `/inventory row`).

### Data, UI, and routing

- Refresh scripts keep the stored value when a fetch fails; never overwrite good data with a fallback.
- Data that rarely changes is bundled with a `SOURCE.md`; a source is the primary publisher's free, documented API, credited on screen as its terms require.
- Live data comes only from the app's own origin: a stateless `api/` function allow-lists its parameters, keeps any free key in the Vercel env, validates and trims the response, and caches at the edge with `stale-while-revalidate` and `stale-if-error`; an upstream failure returns an error, never a cached fallback.
- Model output is generated at build time from fixed options and shipped as data; a shipped app never calls a model and its Vercel project holds no model key (hatch is the standing exception).
- Normalize third-party prose to the house writing rules at ingest, not at render.
- Accent colors carry rules, fills, and icons, never small text; each theme's `--focus` token measures 3:1 or better against its backgrounds.
- A family is a layout, not a look. Each app's look is designed for it at build time: Mobbin research into real current apps in its own category sets the bar, then a random roll of one register lens and one finishing-detail lens, research into the app's own subject, a palette sampled from real references landing on a modern register (a neutral base plus one or two confident accents), open faces that load, and the 390px layout designed first. No palette lists, no hue formulas, and three retired registers, each at most a small accent: skeuomorphic surfaces (leaded glass, terrazzo, riso grain, carbon-copy ghosting, wax crackle, twine, postmarks), the 1970s-80s palette (burnt orange, olive, mustard, rust), and novelty display faces set as UI or body type (Monoton, Silkscreen, stencil faces). It is recorded in the app's catalog record and checked against every other app (`inventory-looks.mjs --candidate`); the built fleet never gains a twin (`looks-twins.json` only shrinks, `npm run verify` fails on a new pair), and `/ship` fails when an app drifts from a designed record (`design-audit --record --strict-record`).
- A new catalog record is never the same app as one already there: `inventory-add.mjs` refuses a near-duplicate unless `--similar-ok` says why, `npm run verify` fails on one nobody answered for, and a full concept audit reads every record every 100 new ones (`/inventory` 8b).
- Display titles break anywhere inside a `min-w-0` wrapper; sum fixed rows against 288px of content at a 320px viewport before claiming no horizontal scroll.
- A handler never moves the control under the pointer: a blur, focus or press that adds, removes or resizes content above or beside the next target moves it before mouseup and the click is lost. Reserve the height for anything a handler can fill, and assert in the browser that the next control's position is unchanged after it fires.
- A control faded on idle still takes a tap: the floating card keeps pointer events inside its own bounds while faded, so a tap on a faded control wakes the chrome and fires the control, and a tap outside the card still reaches the canvas. Prove it on a touch project with `page.clock`.
- Search ranks name matches ahead of text-only matches before truncating.
- Next.js routes with a closed `generateStaticParams` set export `dynamicParams = false`.
- Blueprint acceptance checks that need a browser (a viewport, the keyboard, focus, a swipe, the console) are Playwright checks the gate runs; tag a check browser-only only when automation cannot judge it (how sound or motion feels, a real device).
- A browser check of a timer, a countdown, or a day or week boundary runs on `page.clock` (installed before load, paused after it, stepped with `fastForward`), never on a real wait.
- Every figure, example ID, vector, or date an acceptance check quotes is computed by a script or taken from an independent oracle (a library, a reference fixture, a corpus), never typed from memory; a check that encodes an outside rule names its source.
- The typecheck reads code: a solution-style root `tsconfig.json` needs a `typecheck` script running `tsc -b`.
- A test that asserts against wall-clock time leaves the slower side several times the time it needs, takes the best of several runs, or leaves the real clock; a budget sized to an idle machine fails on load, not on the code.
- The e2e suite runs under the production headers: a preview server sends none of `vercel.json`'s, so add its content security policy to every document response in a spec and fail on a console error or `securitypolicyviolation`.
- The e2e `webServer` owns its port: one no other app uses, `--strictPort`, and `reuseExistingServer: false`, so a run never tests another app's preview or a stale build.
- Offline precache lists come from the build (a Vite plugin, or a later build step over the finished `dist/` when the page is prerendered) or are linted against the files on disk (static). A build-emitted worker matches with `ignoreVary: true` so cors module scripts and fonts still hit the cache when the host answers `Vary: Origin`.
- What first paint does not need is a lazy chunk: the entry carries an index or a shell, a build check proves the lazy part is absent from it, and the lab measures the deep route as well as `/`.
- Locked and disabled states that carry text change shape or token, never opacity.
- An element hidden with the `hidden` attribute whose class sets `display` also gets `.class[hidden] { display: none }` (`house-audit` `hidden-display`).
- A `<label>` never wraps a `<select>`: the options join its accessible name, so the label and the select are siblings tied by `htmlFor` and `id` (`house-audit` `label-select`).
- Unicode escapes stay escapes: after writing one, grep the file for the literal character (`house-audit` `invisible-chars`).
- Copy people read carries no AI tells: no dash used as a clause break, no chatbot phrasing; write and check it with `/humanize` (`house-audit` `ai-tells`).
- Page titles read `Name | Value prop`: the name keeps its own capitalization and the value prop is sentence case with its first word capitalized (`Gambit | Full chess against an alpha-beta engine`); the same string fills `<title>`, `og:title`, and `twitter:title` (`house-audit` `meta-head`). Every other page is `Page | Name`, the page title in sentence case (`The constraints | Engineering`).

## Catalog

This app is the `pagedown` record in the calabrodesign catalog: https://github.com/bryancalabro/calabrodesign/blob/main/specs/app-inventory.md (record `specs/app-inventory/pagedown.md`). Read it before renaming the app, changing its host, or rewriting its description.

## Pagedown

Family: Instrument (split pane, input left / output right, one action top-right, no nav bar). Density tight.

### Build prompt (verbatim from the record)

## Pagedown

**Host:** pagedown.bryancalabro.com
**Family:** Instrument (split pane, input left / output right, one action top-right, no nav bar)
**Hero:** the Markdown output pane
**Stack:** React + Tailwind + Vite, one same-origin Vercel function (`api/fetch`) running Mozilla Readability and Turndown

Build **Pagedown**: paste a URL and get the page's main content back as clean Markdown, with navigation, ads, and page chrome removed.

- URL field with one Fetch action; a bare domain gets `https://`, and anything that is not http or https is refused before a request is made
- **The function fetches server-side and refuses private, loopback, and link-local addresses on every redirect hop**, caps the body at 5 MB and the wait at 10 seconds, and accepts only HTML responses
- Readability picks the main article and Turndown writes GitHub-flavored Markdown: ATX headings, fenced code, tables, and absolute link and image URLs
- The output pane shows the Markdown under a strip with the status code, the final URL after redirects, the word count, and reading time
- Toggle between raw Markdown and a rendered preview of it
- Copy, or download as `<slug>.md`, with optional YAML front matter (title, source URL, byline, fetched date)
- Paste-HTML mode converts raw HTML in the browser, so a page behind a login converts without the server ever seeing it
- One specific message for each failure: blocked address, timeout, not HTML, too large, an upstream 4xx or 5xx, and no readable article found
- Recent fetches (URL, title, time) are kept in localStorage; page bodies never are

**Bolster:**
- Options to drop images, write links reference-style, and strip tracking parameters from every link
- A `?url=` deep link that fetches on load, so a conversion can be shared
- A token estimate beside the word count, for pasting into a chat model

**House rules:** apply `house-rules.md` in full.

### Look

roll: Readwise Reader's editorial reading calm x high-contrast dark mode with one saturated accent | refs: Exa crawling playground, URL input left and a dark results pane with a JSON/Visual toggle, response time and copy (https://mobbin.com/screens/6a2b0081-e92e-4099-a9ee-cba1776617f6); Firecrawl playground, one URL field with an https:// prefix, one primary action and a recent-runs list with status (https://mobbin.com/screens/c2692c1d-b796-4ff8-9123-ced1361e64f5); Google Gemini research reader, a dark reading pane with a calm measure and a quiet export row (https://mobbin.com/screens/e200f2a4-f38a-4882-b92d-422e6628f10e); Kindle sample reader, serif body at a book measure with one thin progress rule (https://mobbin.com/screens/374186a9-1431-4480-8386-7c40754f5959); a copy editor's red proofreading pencil and its delete mark on galley proofs | direction: an ink-navy reading desk where the converted page reads like a galley proof, with one saturated proofreader's red reserved for the fetch action, the stripped-chrome count and focus | signature: a strip above the output that counts what was cut (nav, footer, ads, scripts) beside status, final URL, words and tokens, the proofreader's delete mark beside each count

- Palette: bg #171C2B, surface #1F2536, ink #EEF0F6, muted #A3A9BA, accent #FF3B5C, accent-ink #171C2B (light: bg #F4F2EE, surface #FFFFFF, ink #161A26, muted #565D6E, accent #C8173A, accent-ink #FFFFFF)
- Type pair: Hedvig Letters Serif (display, wordmark, rendered preview headings) / Fragment Mono (UI and the Markdown itself). Both ship one weight (400), so hierarchy comes from size and color, never from bold.
- Radius: 10px panes, 8px controls, 999px status chips. Surface: flat panes on one ground split by a 1px hairline, output pane one step lighter, no shadows.

### Research (Mobbin, 2026-10-14)

- Exa crawling playground: URL input left, dark results pane right with a JSON/Visual toggle, response time and a copy icon. Taken: the raw/preview toggle and the timing in the output strip. https://mobbin.com/screens/6a2b0081-e92e-4099-a9ee-cba1776617f6
- Firecrawl playground: one URL field with an `https://` prefix, one primary action, a recent-runs list with status. Taken: the prefix affordance and the recent list. https://mobbin.com/screens/c2692c1d-b796-4ff8-9123-ced1361e64f5
- Postman request view: method and URL on one line with Send, response status below. Taken: status code as a chip in the strip. https://mobbin.com/screens/bd625124-493c-4504-b10b-67f63885ecf2
- Obvious "Markdown" export dialog: raw Markdown in mono with one Copy button. Taken: copy stays one click from the raw view. https://mobbin.com/screens/f23f64e0-06af-416c-b90c-432b06144af5
- Google Gemini research reader: a dark reading pane with a calm measure and a quiet export row. Taken: the preview's measure and the restraint of the action row. https://mobbin.com/screens/e200f2a4-f38a-4882-b92d-422e6628f10e
- Kindle sample reader: serif body at a book measure. Taken: the preview sets body in the display serif at about 68 characters. https://mobbin.com/screens/374186a9-1431-4480-8386-7c40754f5959

### Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (Playwright on port 4991 against the production build, with the `vercel.json` headers added to every document response).
