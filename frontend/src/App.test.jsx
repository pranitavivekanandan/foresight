import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import App from './App'

import { fakeBackend } from './test/fakeBackend'

function renderAt(hash) {
  window.location.hash = hash
  return render(<App />)
}

describe('App routes', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(fakeBackend))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  it('renders the dashboard with discovered and alert-referenced containers', async () => {
    renderAt('#/')
    expect(screen.getByRole('heading', { name: 'Infrastructure Overview' })).toBeInTheDocument()
    const grid = await screen.findByRole('region', { name: 'Container status' })
    expect(await within(grid).findByText('demo-api')).toBeInTheDocument()
    expect(within(grid).getByText('demo-worker')).toBeInTheDocument()
    expect(screen.getByText(/2 Alerts Pending/)).toBeInTheDocument()
    expect(screen.getByText(/Live from \/api\/stats\/containers/)).toBeInTheDocument()
    expect(screen.getByTestId('bell-dot')).toBeInTheDocument()
    expect(screen.getByText(/Last refreshed:/)).toBeInTheDocument()
  })

  it('renders the metric detail screen with fit, forecast and correlation', async () => {
    renderAt('#/services/demo-api/memory')
    expect(screen.getByRole('heading', { name: 'Memory Utilization' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Memory history and forecast' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Fit (R squared)' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText(/Request rate \/ error rate: n\/a \(not collected\)/)).toBeInTheDocument()
    // demo-worker's alert is grouped under demo-api's alert
    expect(await screen.findByText('demo-worker')).toBeInTheDocument()
    expect(screen.getByText(/projected to cross 90% in about 4 minutes/)).toBeInTheDocument()
  })
})
