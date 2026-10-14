# Deviations

What differed from `blueprint.md` and why. `/phase` appends a `## Phase N` section every phase, and `/retro` adds `## Run audit`.

## Phase 0

No deviations found. This phase produced the spec only.

## Run audit

Greenfield `/new-app` run: no phase was executed with `/phase`, so no feature is `done`. This pass reads every feature against the code on `main` at 0e3678b.

### D1 - Turndown runs in the browser, not in the function

- **Phase / feature:** P1 / PAG-003
- **Specified:** the Stack line names "one same-origin Vercel function (`api/fetch`) running Mozilla Readability and Turndown"
- **Shipped:** the function runs Readability and returns the article HTML (`server/handle.ts`); Turndown runs in the browser as a lazy chunk (`src/lib/markdown.ts`, `src/App.tsx`)
- **Evidence:** commit c7e2a19 and 87fca0c; learnings P0 decision on stubbing the function
- **Severity:** drift
- **Justified in learnings:** yes
- **Call:** accept. The options (images, reference links, tracking) re-convert instantly without a second fetch, and paste-HTML mode shares the same converter

### D2 - jsdom instead of a lighter DOM on the server

- **Phase / feature:** P1 / PAG-002, PAG-003
- **Specified:** no parser named
- **Shipped:** jsdom 26 (`server/handle.ts`); linkedom was tried first and left Readability with no body on pages that omit `<html>` and `<body>`; jsdom 27 failed on Vercel with ERR_REQUIRE_ESM
- **Evidence:** commits e79a6ea and the jsdom 26 pin; `server/runtime.test.ts`
- **Severity:** drift
- **Justified in learnings:** yes
- **Call:** accept

### D3 - About modal

- **Phase / feature:** none
- **Specified:** not in the build list
- **Shipped:** an About button left of the theme control opens a modal through the house Dialog (`src/components/About.tsx`)
- **Evidence:** Bryan asked for it on 2026-10-14; `e2e/dialog.spec.ts`
- **Severity:** extra
- **Justified in learnings:** yes (Bryan's request)
- **Call:** amend spec on the next `/phase` pass

### D4 - Fetch time and cut chips in the strip

- **Phase / feature:** P1 / PAG-004
- **Specified:** status code, final URL, word count, reading time
- **Shipped:** those four plus the fetch time in ms and one chip per kind of chrome cut (`src/components/CutStrip.tsx`)
- **Evidence:** the record's Look signature names the cut count; Exa's response time on Mobbin
- **Severity:** extra
- **Justified in learnings:** yes (the record's signature)
- **Call:** accept; PAG-004 AC-2 already checks the chips
