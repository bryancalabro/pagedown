// one message per failure, in the app's own words: what happened, then what to try.

export type ErrorCode =
  | 'bad-url'
  | 'blocked'
  | 'dns'
  | 'timeout'
  | 'too-large'
  | 'not-html'
  | 'upstream'
  | 'network'
  | 'redirects'
  | 'no-article'
  | 'method'
  | 'offline'
  | 'server'

const REASONS: Record<number, string> = {
  401: 'asks for a login',
  403: 'refused the request',
  404: 'has no page at that address',
  410: 'says the page is gone',
  429: 'is limiting requests right now',
  451: 'blocks the page for legal reasons',
  500: 'had an internal error',
  502: 'had a gateway error',
  503: 'is unavailable right now',
}

export function errorMessage(code: ErrorCode, status?: number): string {
  switch (code) {
    case 'bad-url':
    case 'method':
      return 'That link does not look like a web address. Check it and try again.'
    case 'blocked':
      return 'That address is private or local, so it cannot be fetched from here. For a page on your own network, paste its HTML instead.'
    case 'dns':
      return 'No site answers at that address. Check the spelling of the domain.'
    case 'timeout':
      return 'The site took more than 10 seconds to answer. Try again, or paste the page’s HTML.'
    case 'too-large':
      return 'The page is over 5 MB, too big to convert here. Save it from your browser and paste the part you need.'
    case 'not-html':
      return 'That link points to a file, not a web page. Pagedown converts HTML pages only.'
    case 'upstream': {
      const why = status ? REASONS[status] ?? `answered with an error` : 'answered with an error'
      const code = status ? ` (${status})` : ''
      const hint = status === 401 || status === 403 ? ' If you can open it in your browser, paste its HTML here instead.' : ' Check the link, or try again later.'
      return `The site ${why}${code}.${hint}`
    }
    case 'redirects':
      return 'The link redirects more than five times, so Pagedown stopped following it.'
    case 'no-article':
      return 'The page loaded, but no article was found on it. It may build its text with JavaScript; open it in your browser and paste its HTML instead.'
    case 'offline':
      return 'You are offline. Paste the page’s HTML instead, or try again when you are back online.'
    case 'network':
      return 'The site could not be reached. Try again in a moment.'
    case 'server':
      return 'The fetcher did not answer. Try again in a moment.'
  }
}

export const INPUT_MESSAGES = {
  empty: 'Paste a link to fetch.',
  scheme: 'Only http and https links can be fetched.',
  invalid: 'That does not look like a web address.',
  pasteEmpty: 'Paste some HTML first.',
} as const
