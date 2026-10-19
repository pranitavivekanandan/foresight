import { describe, it, expect } from 'vitest'
import { formatPercent, formatUsd, formatMb, formatClock, minutesBetween, formatAgo, formatDuration, initials } from './format'

describe('format helpers', () => {
  it('formatPercent', () => {
    expect(formatPercent(42.345)).toBe('42.3%')
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent('x')).toBe('—')
  })

  it('formatUsd uses more decimals for sub-cent values', () => {
    expect(formatUsd(30.37)).toBe('$30.37')
    expect(formatUsd(0.0007)).toBe('$0.0007')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(null)).toBe('n/a')
  })

  it('formatMb switches to GB at 1024', () => {
    expect(formatMb(512)).toBe('512 MB')
    expect(formatMb(2048)).toBe('2.00 GB')
    expect(formatMb(undefined)).toBe('—')
  })

  it('formatClock pads to HH:MM:SS', () => {
    expect(formatClock(new Date(2026, 0, 1, 4, 5, 6))).toBe('04:05:06')
    expect(formatClock(null)).toBe('—')
    expect(formatClock('nope')).toBe('—')
  })

  it('minutesBetween and formatAgo', () => {
    expect(minutesBetween('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z')).toBe(30)
    expect(minutesBetween('bad')).toBeNull()
    expect(formatAgo(null)).toBe('never')
    expect(formatAgo(0.5)).toBe('just now')
    expect(formatAgo(12.9)).toBe('12 min ago')
    expect(formatAgo(130)).toBe('2 h ago')
    expect(formatAgo(60 * 24 * 3)).toBe('3 d ago')
  })

  it('formatDuration', () => {
    expect(formatDuration(0.2)).toBe('<1 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(180)).toBe('3.0 h')
    expect(formatDuration(60 * 24 * 3)).toBe('3.0 d')
    expect(formatDuration(null)).toBe('—')
  })

  it('initials', () => {
    expect(initials('Alex Sterling')).toBe('AS')
    expect(initials('  riley  ')).toBe('R')
    expect(initials('')).toBe('')
  })
})
