import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import AlertsFeed from './AlertsFeed'

const make = (id, overrides = {}) => ({
  id,
  time: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(),
  containerId: `svc-${id}`,
  containerName: `svc-${id}`,
  metric: 'memPercent',
  currentValue: 80,
  predictedBreachMinutes: 10,
  explanation: `svc-${id} memPercent is projected to cross 90% in about 10 minutes.`,
  costRestartUsd: 0.0007,
  costUpgradeUsd: 30.37,
  groupedWith: null,
  resolved: false,
  ...overrides,
})

describe('AlertsFeed (wireframe 4)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('shows wireframe columns, derived severity and status pills', () => {
    const alerts = [make(1), make(2, { predictedBreachMinutes: 45 }), make(3, { predictedBreachMinutes: 300, resolved: true })]
    render(<AlertsFeed alerts={alerts} onSelectAlert={() => {}} acknowledgedIds={[2]} />)

    expect(screen.getByRole('heading', { name: 'Active Alerts Feed' })).toBeInTheDocument()
    for (const header of ['Severity', 'Alert title', 'Service', 'Time fired', 'Status', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    const row = (name) => screen.getByText(name).closest('tr')
    expect(within(row('svc-1')).getByText('Critical')).toBeInTheDocument()
    expect(within(row('svc-1')).getByText('Active')).toBeInTheDocument()
    expect(within(row('svc-2')).getByText('High')).toBeInTheDocument()
    expect(within(row('svc-2')).getByText('Acknowledged')).toBeInTheDocument()
    expect(within(row('svc-3')).getByText('Warning')).toBeInTheDocument()
    expect(within(row('svc-3')).getByText('Resolved')).toBeInTheDocument()
  })

  it('expands grouped children as indented instance rows', () => {
    render(<AlertsFeed alerts={[make(1), make(2, { groupedWith: 1 })]} onSelectAlert={() => {}} />)
    expect(screen.getByText(/1 grouped beneath/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Expand grouped alerts'))
    const child = screen.getByText('svc-2').closest('tr')
    expect(child).toHaveClass('alert-row-child')
    expect(within(child).getByText(/Instance:/)).toBeInTheDocument()
    expect(within(child).getByText(/Memory 80.0% · breach in ~10 min/)).toBeInTheDocument()
  })

  it('filters by status and severity', () => {
    const alerts = [make(1), make(2, { predictedBreachMinutes: 45 }), make(3, { resolved: true })]
    render(<AlertsFeed alerts={alerts} onSelectAlert={() => {}} />)

    fireEvent.change(screen.getByLabelText('Severity filter'), { target: { value: 'high' } })
    expect(screen.queryByText('svc-1')).not.toBeInTheDocument()
    expect(screen.getByText('svc-2')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Severity filter'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'resolved' } })
    expect(screen.getByText('svc-3')).toBeInTheDocument()
    expect(screen.queryByText('svc-1')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'acknowledged' } })
    expect(screen.getByText('No alerts match these filters.')).toBeInTheDocument()
  })

  it('paginates root rows client-side', () => {
    const alerts = Array.from({ length: 5 }, (_, i) => make(i + 1))
    render(<AlertsFeed alerts={alerts} onSelectAlert={() => {}} pageSize={2} />)
    expect(screen.getByText(/Showing 1–2 of 5 alerts/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(screen.getByText(/Showing 3–4 of 5 alerts/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(screen.getByText(/Showing 5–5 of 5 alerts/)).toBeInTheDocument()
    expect(screen.getByLabelText('Next page')).toBeDisabled()
  })

  it('exports the filtered alerts as CSV', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    render(<AlertsFeed alerts={[make(1)]} onSelectAlert={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Export Logs/ }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(await blob.text()).toMatch(/^id,time,container_id/)
  })

  it('acknowledge and view actions call back without opening the row twice', () => {
    const onSelectAlert = vi.fn()
    const onToggleAcknowledged = vi.fn()
    render(<AlertsFeed alerts={[make(1)]} onSelectAlert={onSelectAlert} onToggleAcknowledged={onToggleAcknowledged} />)
    fireEvent.click(screen.getByLabelText('Acknowledge alert'))
    expect(onToggleAcknowledged).toHaveBeenCalledWith(1, true)
    expect(onSelectAlert).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('View alert'))
    expect(onSelectAlert).toHaveBeenCalledTimes(1)
  })
})
