import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

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



  it('renders alert detail with simulated, local and real actions', async () => {

    renderAt('#/alerts/1')

    expect(await screen.findByRole('heading', { name: 'Memory predicted to breach 90%' })).toBeInTheDocument()

    expect(screen.getByText('Critical')).toBeInTheDocument()

    expect(screen.getByText('$0.0007')).toBeInTheDocument()

    expect(screen.getByText('$30.37')).toBeInTheDocument()



    fireEvent.click(screen.getByRole('button', { name: /Apply upgrade now/ }))

    expect(await screen.findByText(/Simulated: not connected to infrastructure/)).toBeInTheDocument()



    fireEvent.click(screen.getByRole('button', { name: /Acknowledge Alert/ }))

    expect(JSON.parse(window.localStorage.getItem('foresight:acknowledged-alerts'))).toEqual([1])



    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: 'DevOps_OnCall' } })

    expect(JSON.parse(window.localStorage.getItem('foresight:alert-assignees'))).toEqual({ 1: 'DevOps_OnCall' })



    fireEvent.click(screen.getByRole('button', { name: /^Resolve$/ }))

    await waitFor(() =>

      expect(fetch).toHaveBeenCalledWith('/api/alerts/1/resolve', expect.objectContaining({ method: 'PATCH' })),

    )

  })



  it('shows not found for an unknown alert id', async () => {

    renderAt('#/alerts/999')

    expect(await screen.findByText('Alert 999 not found')).toBeInTheDocument()

  })



  it('settings: invite member is stored locally and integrations are simulated', async () => {

    renderAt('#/settings')

    expect(screen.getByRole('heading', { name: 'Organization Settings' })).toBeInTheDocument()

    expect(screen.getAllByText('Sample')).toHaveLength(3)



    fireEvent.click(screen.getByRole('button', { name: /Invite member/ }))

    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: 'Sam Lee' } })

    fireEvent.change(screen.getByLabelText('Member email'), { target: { value: 'sam@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add to table' }))

    expect(screen.getByText('Sam Lee')).toBeInTheDocument()

    expect(JSON.parse(window.localStorage.getItem('foresight:team-members')).map((m) => m.name)).toContain('Sam Lee')



    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))

    expect(await screen.findByText(/Simulated: not connected to infrastructure/)).toBeInTheDocument()



    fireEvent.click(screen.getByRole('button', { name: /Add New Integration/ }))

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add integration' })).getByRole('button', { name: /Discord/ }))

    expect(screen.getByLabelText('Discord webhook URL')).toBeInTheDocument()

  })



  it('settings cost tab falls back to alert costs when /api/cost-table 404s', async () => {

    renderAt('#/settings/cost')

    expect(await screen.findByText(/Endpoint not available: GET \/api\/cost-table returned 404/)).toBeInTheDocument()

    expect(await screen.findByText('$30.37')).toBeInTheDocument()

    expect(screen.getAllByText('USD · unit unconfirmed')).toHaveLength(2)

  })



  it('settings security tab is a planned-feature placeholder', () => {

    renderAt('#/settings/security')

    expect(screen.getByText(/planned feature/i)).toBeInTheDocument()

  })


  it('rules: falls back to local defaults and saves new rules locally', async () => {
    renderAt('#/rules')
    expect(screen.getByRole('heading', { name: 'Alert Rule Configuration' })).toBeInTheDocument()
    expect(await screen.findByText('stored locally')).toBeInTheDocument()
    expect(screen.getByText('2 total rules')).toBeInTheDocument()
    expect(screen.getByText(/backend alert evaluator is still configured by environment variables/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Select metric'), { target: { value: 'cpuPercent' } })
    fireEvent.change(screen.getByLabelText('Threshold value'), { target: { value: '85' } })
    expect(screen.getByText(/This rule checks CPU on All containers and fires when it is greater than 85% sustained for 5 min./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Enable predictive alerting' }))
    expect(await screen.findByText('Live preview from current history')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save & Activate Rule' }))
    expect(await screen.findByText('3 total rules')).toBeInTheDocument()
    expect(screen.getByText('> 85% for 5m')).toBeInTheDocument()
    const stored = JSON.parse(window.localStorage.getItem('foresight:rules'))
    expect(stored.at(-1)).toMatchObject({ metric: 'cpuPercent', value: 85, durationMin: 5, predictive: true })
    // POST /api/rules was attempted before falling back
    expect(fetch).toHaveBeenCalledWith('/api/rules', expect.objectContaining({ method: 'POST' }))
  })

  it('rules: rejects an invalid threshold', async () => {
    renderAt('#/rules')
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Activate Rule' }))
    expect(screen.getByText('Enter a percentage between 0 and 100.')).toBeInTheDocument()
  })

  it('saved rule thresholds drive the prediction display', async () => {
    window.localStorage.setItem(
      'foresight:rules',
      JSON.stringify([{ id: 'r1', metric: 'memPercent', scope: 'all', operator: 'gt', value: 75, durationMin: 0, predictive: true }]),
    )
    renderAt('#/services/demo-api/memory')
    expect(await screen.findByText('Threshold 75%')).toBeInTheDocument()
  })
})
