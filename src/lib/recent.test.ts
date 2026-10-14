import { describe, expect, it } from 'vitest'
import { hostOf, remember } from './recent'
import { RECENT_LIMIT } from './store'

describe('remember', () => {
  it('puts the newest first and keeps one entry per url', () => {
    const a = { url: 'https://a.test/', title: 'A', at: 1 }
    const b = { url: 'https://b.test/', title: 'B', at: 2 }
    expect(remember(remember([a], b), { ...a, at: 3 })).toEqual([{ ...a, at: 3 }, b])
  })
  it('caps the list', () => {
    let list: ReturnType<typeof remember> = []
    for (let i = 0; i < 20; i++) list = remember(list, { url: `https://x.test/${i}`, title: '', at: i })
    expect(list).toHaveLength(RECENT_LIMIT)
    expect(list[0].url).toBe('https://x.test/19')
  })
  it('shows a short host', () => {
    expect(hostOf('https://www.example.com/a')).toBe('example.com')
    expect(hostOf('nope')).toBe('nope')
  })
})
