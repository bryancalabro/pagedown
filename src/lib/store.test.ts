import { describe, expect, it } from 'vitest'
import { RECENT_LIMIT, STORE_KEY, defaults, load, migrate, save } from './store'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('store', () => {
  it('uses the host key', () => {
    expect(STORE_KEY).toBe('bc:pagedown.bryancalabro.com')
  })
  it('gives defaults for nothing, junk and unknown versions', () => {
    expect(migrate(null)).toEqual(defaults())
    expect(migrate('x')).toEqual(defaults())
    expect(migrate({ v: 99, theme: 'dark' })).toEqual(defaults())
  })
  it('keeps valid fields and drops bad ones', () => {
    const s = migrate({ v: 1, theme: 'dark', options: { images: false, frontMatter: 'yes' }, recent: [{ url: 'https://a.test/', title: 'A', at: 1 }, { url: 2 }] })
    expect(s.theme).toBe('dark')
    expect(s.options.images).toBe(false)
    expect(s.options.frontMatter).toBe(false)
    expect(s.recent).toEqual([{ url: 'https://a.test/', title: 'A', at: 1 }])
  })
  it('caps the recent list', () => {
    const recent = Array.from({ length: 30 }, (_, i) => ({ url: `https://a.test/${i}`, title: '', at: i }))
    expect(migrate({ v: 1, recent }).recent).toHaveLength(RECENT_LIMIT)
  })
  it('round-trips through storage and survives storage that throws', () => {
    const mem = memory()
    const s = { ...defaults(), theme: 'light' as const }
    expect(save(s, mem)).toBe(true)
    expect(load(mem)).toEqual(s)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(load(broken)).toEqual(defaults())
    expect(save(s, broken)).toBe(false)
    expect(load(undefined)).toEqual(defaults())
  })
})
