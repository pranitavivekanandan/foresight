import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadText, timestampForFilename } from './download'

describe('downloadText', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a blob URL, clicks a temporary link and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:1')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadText('a,b', 'x.csv', 'text/csv')

    expect(createObjectURL.mock.calls[0][0].type).toBe('text/csv')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
})

describe('timestampForFilename', () => {
  it('has no colons', () => {
    expect(timestampForFilename(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T030405')
  })
})
