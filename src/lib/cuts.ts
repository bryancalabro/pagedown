// the kinds of page chrome the extractor counts; its own module so the strip that shows them
// does not pull readability into the first chunk

export interface Cuts {
  nav: number
  header: number
  footer: number
  aside: number
  ads: number
  scripts: number
  iframes: number
  forms: number
}

export const CUT_KINDS: (keyof Cuts)[] = ['nav', 'header', 'footer', 'aside', 'ads', 'scripts', 'iframes', 'forms']
