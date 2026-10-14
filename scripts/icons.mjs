// renders the favicons from the catalog record's tokens and display face.
// resvg reads only static TTF instances (scripts/fonts, see SOURCE.md), never WOFF2.
// run with `npm run icons`; the outputs are committed under public/favicons.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '..', 'public', 'favicons')
mkdirSync(out, { recursive: true })

// record: pagedown palette (dark theme first)
const BG = '#171C2B'
const ACCENT = '#FF3B5C'

const fonts = {
  fontFiles: [
    path.join(here, 'fonts', 'hedvig-letters-serif-latin-400-normal.ttf'),
    path.join(here, 'fonts', 'fragment-mono-latin-400-normal.ttf'),
  ],
  loadSystemFonts: false,
  defaultFontFamily: 'Fragment Mono',
}
const DISPLAY = 'Hedvig Letters Serif 24pt 24pt'

const render = (svg, width) => new Resvg(svg, { font: fonts, fitTo: { mode: 'width', value: width } })

// the favicon: the wordmark's first letter in the accent on the ground, drawn as a path
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${BG}"/>
  <text x="32" y="47" text-anchor="middle" font-family="${DISPLAY}" font-weight="400" font-size="46" fill="${ACCENT}">P</text>
</svg>`
const iconPaths = render(icon, 64).toString()
writeFileSync(path.join(out, 'favicon.svg'), iconPaths + '\n')
for (const [name, size] of [['favicon-32.png', 32], ['favicon-48.png', 48], ['favicon-180.png', 180]]) {
  writeFileSync(path.join(out, name), render(iconPaths, size).render().asPng())
}

// the OG image (public/favicons/og-image.jpg) is Bryan's supplied artwork, cropped to 1200x630;
// this script leaves it alone so a favicon rerun never overwrites it
console.log('wrote favicons')
