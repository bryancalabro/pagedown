// one versioned JSON object under localStorage["bc:pagedown.bryancalabro.com"].
// it holds the theme, the conversion options and the recent fetches (url, title, time).
// page bodies and pasted html never touch storage.
// every read and write is guarded: private windows and blocked storage throw, and the app
// still renders with defaults.

export const STORE_KEY = 'bc:pagedown.bryancalabro.com'
export const STORE_VERSION = 1
export const RECENT_LIMIT = 12

export type ThemeChoice = 'system' | 'light' | 'dark'

export interface Options {
  images: boolean
  referenceLinks: boolean
  stripTracking: boolean
  frontMatter: boolean
}

export interface Recent {
  url: string
  title: string
  at: number
}

export interface StoreV1 {
  v: 1
  theme: ThemeChoice
  options: Options
  recent: Recent[]
}

export type Store = StoreV1

export const defaultOptions = (): Options => ({ images: true, referenceLinks: false, stripTracking: true, frontMatter: false })

export const defaults = (): Store => ({ v: 1, theme: 'system', options: defaultOptions(), recent: [] })

const isTheme = (t: unknown): t is ThemeChoice => t === 'system' || t === 'light' || t === 'dark'

function readOptions(raw: unknown): Options {
  const d = defaultOptions()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  const flag = (k: keyof Options) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : d[k])
  return { images: flag('images'), referenceLinks: flag('referenceLinks'), stripTracking: flag('stripTracking'), frontMatter: flag('frontMatter') }
}

function readRecent(raw: unknown): Recent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Recent => !!r && typeof r === 'object' && typeof r.url === 'string' && typeof r.title === 'string' && typeof r.at === 'number')
    .map((r) => ({ url: r.url, title: r.title, at: r.at }))
    .slice(0, RECENT_LIMIT)
}

/** bring any stored shape up to the current version; unknown or broken input gives the defaults */
export function migrate(raw: unknown): Store {
  if (!raw || typeof raw !== 'object') return defaults()
  const o = raw as Record<string, unknown>
  switch (o.v) {
    case 1:
      return { v: 1, theme: isTheme(o.theme) ? o.theme : 'system', options: readOptions(o.options), recent: readRecent(o.recent) }
    default:
      return defaults()
  }
}

/** localStorage, or undefined where reading the property itself throws (blocked site data) */
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function load(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): Store {
  try {
    const text = storage?.getItem(STORE_KEY)
    return text ? migrate(JSON.parse(text)) : defaults()
  } catch {
    return defaults()
  }
}

export function save(store: Store, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}
