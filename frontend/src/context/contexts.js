import { createContext, useContext } from 'react'
import { DEFAULT_RULES } from '../rules'

// Context objects and their hooks live here (not in the provider files) so
// the provider files only export components, as react-refresh requires.

export const SIMULATED_MESSAGE = 'Simulated: not connected to infrastructure'

// Default value is a no-op so components render in tests without a provider.
export const ToastContext = createContext({ show: () => {}, simulated: () => {} })

export const RulesContext = createContext({
  rules: DEFAULT_RULES,
  source: 'local',
  loading: false,
  saveRule: async () => 'local',
  removeRule: () => {},
})

export const DataContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function useRules() {
  return useContext(RulesContext)
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside <DataProvider>')
  return value
}
