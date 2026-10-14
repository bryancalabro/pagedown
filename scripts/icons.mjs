// renders the favicons and the OG image from the catalog record's tokens and display face.
// resvg reads only static TTF instances (scripts/fonts, see SOURCE.md), never WOFF2.
// run with `npm run icons`; the outputs are committed under public/favicons.
import { Resvg } from '@resvg/resvg-js'
import jpeg from 'jpeg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '..', 'public', 'favicons')
mkdirSync(out, { recursive: true })

// record: pagedown palette (dark theme first)
const BG = '#171C2B'
const SURFACE = '#1F2536'
const INK = '#EEF0F6'
const MUTED = '#A3A9BA'
const ACCENT = '#FF3B5C'
// mixed here because resvg ignores color-mix(): ink at 12% over the ground
const LINE = '#2F3443'

const fonts = {
  fontFiles: [
    path.join(here, 'fonts', 'hedvig-letters-serif-latin-400-normal.ttf'),
    path.join(here, 'fonts', 'fragment-mono-latin-400-normal.ttf'),
  ],
  loadSystemFonts: false,
  defaultFontFamily: 'Fragment Mono',
}
const DISPLAY = 'Hedvig Letters Serif 24pt 24pt'
const BODY = 'Fragment Mono'

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

// the OG image: the wordmark, the value prop, and the signature strip that counts what was cut
const cuts = [['nav', 3], ['footer', 1], ['ads', 4], ['scripts', 17]]
let x = 96
const chips = cuts
  .map(([label, n]) => {
    const text = `${label} ${n}`
    const w = 40 + text.length * 17
    const chip = `<rect x="${x}" y="398" width="${w}" height="48" rx="24" fill="${SURFACE}" stroke="${LINE}"/>
  <path d="M${x + 18} 414 l12 16 M${x + 30} 414 l-12 16" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>
  <text x="${x + 40}" y="430" font-family="${BODY}" font-size="24" fill="${INK}">${text}</text>`
    x += w + 14
    return chip
  })
  .join('\n  ')
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <path d="M96 150 l22 22 22 -22" fill="none" stroke="${ACCENT}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="164" y="180" font-family="${DISPLAY}" font-weight="400" font-size="84" fill="${INK}">Pagedown</text>
  <text x="96" y="290" font-family="${DISPLAY}" font-weight="400" font-size="52" fill="${INK}">Turn any web page into clean Markdown</text>
  <text x="96" y="354" font-family="${BODY}" font-size="26" fill="${MUTED}">200 OK · 1,284 words · ~1,700 tokens</text>
  ${chips}
  <rect x="96" y="500" width="1008" height="1" fill="${LINE}"/>
  <text x="96" y="552" font-family="${BODY}" font-size="26" fill="${MUTED}"># The article, and nothing else</text>
</svg>`
const { width, height, pixels } = render(og, 1200).render()
writeFileSync(path.join(out, 'og-image.jpg'), jpeg.encode({ data: pixels, width, height }, 90).data)
console.log('wrote favicons and og-image.jpg')
