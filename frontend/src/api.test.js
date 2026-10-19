import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAlerts, resolveAlert, BackendUnreachableError } from './api'

describe('getAlerts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed alert array on success', async () => {
    const alerts = [{ id: 1, containerId: 'a', resolved: false }]
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(alerts) })

    await expect(getAlerts()).resolves.toEqual(alerts)
    expect(fetch).toHaveBeenCalledWith('/api/alerts', expect.objectContaining({ signal: expect.anything() }))
  })

  it('throws BackendUnreachableError when fetch itself fails', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getAlerts()).rejects.toBeInstanceOf(BackendUnreachableError)
  })

  it('throws when the server responds with a non-OK status', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(getAlerts()).rejects.toThrow('HTTP 500')
  })

  it('throws when the response body is not an array', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ not: 'an array' }) })

    await expect(getAlerts()).rejects.toThrow('Unexpected response format')
  })
})

describe('resolveAlert', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the resolve endpoint and returns the updated alert', async () => {
    const updated = { id: 7, resolved: true }
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) })

    await expect(resolveAlert(7)).resolves.toEqual(updated)
    expect(fetch).toHaveBeenCalledWith(
      '/api/alerts/7/resolve',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('throws BackendUnreachableError when fetch itself fails', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(resolveAlert(7)).rejects.toBeInstanceOf(BackendUnreachableError)
  })

  it('throws when the server responds with a non-OK status', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 })

    await expect(resolveAlert(999)).rejects.toThrow('HTTP 404')
  })
})
