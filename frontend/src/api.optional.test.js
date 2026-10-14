import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getContainers, getHealth, getRules, createRule, getCostTable, BackendUnreachableError } from './api'

describe('new api calls', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('getContainers returns the array and rejects bad shapes', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ containerId: 'a' }]) })
    await expect(getContainers()).resolves.toEqual([{ containerId: 'a' }])
    expect(fetch).toHaveBeenCalledWith('/api/stats/containers', expect.anything())

    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
    await expect(getContainers()).rejects.toThrow('Unexpected response format')

    fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(getContainers()).rejects.toThrow('HTTP 500')

    fetch.mockRejectedValueOnce(new TypeError('down'))
    await expect(getContainers()).rejects.toBeInstanceOf(BackendUnreachableError)
  })

  it('getHealth never throws and reports latency', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    const ok = await getHealth()
    expect(ok.ok).toBe(true)
    expect(ok.latencyMs).toBeGreaterThanOrEqual(0)

    fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    expect((await getHealth()).ok).toBe(false)

    fetch.mockRejectedValueOnce(new TypeError('down'))
    expect(await getHealth()).toEqual({ ok: false, latencyMs: null })
  })

  it('optional endpoints report unavailable on 404 instead of throwing', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 })
    await expect(getRules()).resolves.toEqual({ available: false })
    await expect(getCostTable()).resolves.toEqual({ available: false })
    await expect(createRule({ id: 'r' })).resolves.toEqual({ available: false })
    expect(fetch).toHaveBeenLastCalledWith('/api/rules', expect.objectContaining({ method: 'POST', body: '{"id":"r"}' }))
  })

  it('optional endpoints return data when available and throw on server errors', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([1]) })
    await expect(getRules()).resolves.toEqual({ available: true, data: [1] })

    fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(getCostTable()).rejects.toThrow('HTTP 500 for GET /api/cost-table')

    fetch.mockRejectedValueOnce(new TypeError('down'))
    await expect(getRules()).rejects.toBeInstanceOf(BackendUnreachableError)
  })
})
