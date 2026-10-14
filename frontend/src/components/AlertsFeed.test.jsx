import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AlertsFeed from './AlertsFeed'

const rootAlert = {
  id: 1,
  time: '2026-01-01T00:00:00Z',
  containerId: 'auth-service',
  containerName: 'auth-service',
  metric: 'memPercent',
  currentValue: 88,
  predictedBreachMinutes: 5,
  explanation: 'auth-service memory climbing',
  costRestartUsd: 0.01,
  costUpgradeUsd: 12.5,
  groupedWith: null,
  resolved: false,
}

const childAlert = {
  ...rootAlert,
  id: 2,
  containerId: 'worker-service',
  containerName: 'worker-service',
  explanation: 'worker-service memory climbing too',
  groupedWith: 1,
}

describe('AlertsFeed', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state when there are no alerts matching the filter', () => {
    render(<AlertsFeed alerts={[]} onSelectAlert={() => {}} onAlertsChanged={() => {}} />)
    expect(screen.getByText(/No active alerts/i)).toBeInTheDocument()
  })

  it('groups a child alert under its root and only shows it once expanded', () => {
    render(<AlertsFeed alerts={[rootAlert, childAlert]} onSelectAlert={() => {}} onAlertsChanged={() => {}} />)

    expect(screen.getByText('auth-service')).toBeInTheDocument()
    expect(screen.queryByText('worker-service')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Expand grouped alerts/i))

    expect(screen.getByText('worker-service')).toBeInTheDocument()
  })

  it('calls the resolve endpoint (PATCH) when Resolve is clicked', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1, resolved: true }) })
    const onAlertsChanged = vi.fn()

    render(<AlertsFeed alerts={[rootAlert]} onSelectAlert={() => {}} onAlertsChanged={onAlertsChanged} />)

    const row = screen.getByText('auth-service').closest('.alert-row')
    fireEvent.click(within(row).getByRole('button', { name: /resolve/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/alerts/1/resolve', expect.objectContaining({ method: 'PATCH' })))
    await waitFor(() => expect(onAlertsChanged).toHaveBeenCalled())
  })
})
