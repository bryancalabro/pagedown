import { describe, expect, it } from 'vitest'
import { normalizeUrl, slugify, stripTracking } from './url'

describe('normalizeUrl', () => {
  it('adds https to a bare domain', () => {
    expect(normalizeUrl('example.com/post')).toEqual({ ok: true, url: 'https://example.com/post' })
    expect(normalizeUrl('  example.com  ')).toEqual({ ok: true, url: 'https://example.com/' })
    expect(normalizeUrl('example.com:8080/x')).toEqual({ ok: true, url: 'https://example.com:8080/x' })
    expect(normalizeUrl('//example.com/x')).toEqual({ ok: true, url: 'https://example.com/x' })
  })
  it('keeps http and https', () => {
    expect(normalizeUrl('http://example.com')).toEqual({ ok: true, url: 'http://example.com/' })
    expect(normalizeUrl('HTTPS://Example.com/A')).toEqual({ ok: true, url: 'https://example.com/A' })
  })
  it('refuses other schemes and junk', () => {
    expect(normalizeUrl('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeUrl('ftp://example.com/file')).toEqual({ ok: false, reason: 'scheme' })
    expect(normalizeUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'scheme' })
    expect(normalizeUrl('file:///etc/passwd')).toEqual({ ok: false, reason: 'scheme' })
    expect(normalizeUrl('hello')).toEqual({ ok: false, reason: 'invalid' })
    expect(normalizeUrl('https://exa mple.com')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('stripTracking', () => {
  it('drops tracking parameters and keeps the rest', () => {
    expect(stripTracking('https://example.com/out?utm_source=n&utm_medium=e&fbclid=a&gclid=x&ref=keep')).toBe('https://example.com/out?ref=keep')
    expect(stripTracking('https://example.com/out?utm_source=n')).toBe('https://example.com/out')
    expect(stripTracking('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c')
    expect(stripTracking('mailto:a@x.test?utm_source=x')).toBe('mailto:a@x.test?utm_source=x')
  })
})

describe('slugify', () => {
  it('makes a file name from a title', () => {
    expect(slugify('Field notes on quiet software')).toBe('field-notes-on-quiet-software')
    expect(slugify('Café: déjà vu?!')).toBe('cafe-deja-vu')
    expect(slugify('***')).toBe('page')
    expect(slugify('a'.repeat(100)).length).toBe(80)
  })
})
