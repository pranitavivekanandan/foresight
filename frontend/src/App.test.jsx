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
})
