import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readJson, writeJson } from './storage'

describe('storage', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('round-trips JSON under a prefixed key', () => {
    expect(writeJson('k', { a: 1 })).toBe(true)
    expect(window.localStorage.getItem('foresight:k')).toBe('{"a":1}')
    expect(readJson('k', null)).toEqual({ a: 1 })
  })

  it('returns the fallback for missing or corrupt values', () => {
    expect(readJson('missing', [])).toEqual([])
    window.localStorage.setItem('foresight:bad', '{not json')
    expect(readJson('bad', 'fallback')).toBe('fallback')
  })

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(writeJson('k', 1)).toBe(false)
  })
})
