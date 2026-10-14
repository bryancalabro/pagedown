import { describe, expect, it } from 'vitest'
import { ago } from './time'

describe('ago', () => {
  const now = 1_800_000_000_000
  it('reads like a person', () => {
    expect(ago(now - 10_000, now)).toBe('just now')
    expect(ago(now - 5 * 60_000, now)).toBe('5 minutes ago')
    expect(ago(now - 3 * 3_600_000, now)).toBe('3 hours ago')
    expect(ago(now - 86_400_000, now)).toBe('yesterday')
    expect(ago(now - 14 * 86_400_000, now)).toBe('2 weeks ago')
  })
})
