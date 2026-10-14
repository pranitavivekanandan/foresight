import { describe, it, expect } from 'vitest'
import {
  SAMPLE_TEAM,
  validateMember,
  addMember,
  updateMemberRole,
  removeById,
  addIntegration,
  updateIntegrationTarget,
  costsFromAlerts,
  flattenForTable,
} from './settings'

describe('team helpers', () => {
  it('marks every sample row as sample data', () => {
    expect(SAMPLE_TEAM.every((m) => m.sample)).toBe(true)
  })

  it('validates name, email, duplicates and role', () => {
    expect(validateMember({ name: 'A', email: 'a@b.co', role: 'Admin' })).toEqual({})
    expect(Object.keys(validateMember({ name: ' ', email: 'nope', role: 'King' })).sort()).toEqual(['email', 'name', 'role'])
    expect(validateMember({ name: 'A', email: 'ALEX.S@example.com', role: 'Admin' }, SAMPLE_TEAM).email).toMatch(/already/)
  })

  it('adds, re-roles and removes members', () => {
    const added = addMember([], { name: ' Sam ', email: ' sam@x.io ', role: 'Operator' }, 'm1')
    expect(added).toEqual([{ id: 'm1', name: 'Sam', email: 'sam@x.io', role: 'Operator', lastActive: 'Invited', sample: false }])
    expect(updateMemberRole(added, 'm1', 'Admin')[0].role).toBe('Admin')
    expect(updateMemberRole(added, 'other', 'Admin')[0].role).toBe('Operator')
    expect(removeById(added, 'm1')).toEqual([])
  })
})

describe('integration helpers', () => {
  it('adds and edits integrations', () => {
    const list = addIntegration([], 'discord', 'd1')
    expect(list).toEqual([{ id: 'd1', type: 'discord', target: '' }])
    expect(updateIntegrationTarget(list, 'd1', 'https://x')[0].target).toBe('https://x')
  })
})

describe('costsFromAlerts', () => {
  it('returns the newest alert that has cost estimates', () => {
    const alerts = [
      { id: 1, time: '2026-01-01T00:00:00Z', costRestartUsd: 1, costUpgradeUsd: 2 },
      { id: 2, time: '2026-01-02T00:00:00Z', costRestartUsd: 3, costUpgradeUsd: 4 },
      { id: 3, time: '2026-01-03T00:00:00Z', costRestartUsd: null, costUpgradeUsd: null },
    ]
    expect(costsFromAlerts(alerts)).toEqual({ alertId: 2, time: '2026-01-02T00:00:00Z', costRestartUsd: 3, costUpgradeUsd: 4 })
    expect(costsFromAlerts([])).toBeNull()
    expect(costsFromAlerts(undefined)).toBeNull()
  })
})

describe('flattenForTable', () => {
  it('flattens nested objects and arrays into dotted keys', () => {
    expect(flattenForTable({ region: 'us-east-1', prices: { a: 1 }, tiers: ['t3'] })).toEqual([
      { key: 'region', value: 'us-east-1' },
      { key: 'prices.a', value: 1 },
      { key: 'tiers.0', value: 't3' },
    ])
    expect(flattenForTable(5)).toEqual([{ key: 'value', value: 5 }])
    expect(flattenForTable({ empty: {} })).toEqual([{ key: 'empty', value: '{}' }])
  })
})
