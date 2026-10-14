import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRules, createRule } from '../api'
import { DEFAULT_RULES } from '../rules'
import { readJson, writeJson, STORAGE_KEYS } from '../storage'
import { RulesContext } from './contexts'

// Rules come from GET /api/rules when the backend has it. It does not today,
// so they fall back to localStorage, seeded with DEFAULT_RULES. `source`
// tells the UI which one it is showing ('remote' | 'local').

function loadLocal() {
  const stored = readJson(STORAGE_KEYS.rules, null)
  if (Array.isArray(stored)) return stored
  writeJson(STORAGE_KEYS.rules, DEFAULT_RULES)
  return DEFAULT_RULES
}

export function RulesProvider({ children }) {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [source, setSource] = useState('local')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = await getRules()
      if (result.available && Array.isArray(result.data)) {
        setRules(result.data)
        setSource('remote')
        setLoading(false)
        return
      }
    } catch {
      // Backend unreachable or erroring: use the local copy rather than
      // showing nothing.
    }
    setRules(loadLocal())
    setSource('local')
    setLoading(false)
  }, [])

  useEffect(() => {
    // Fetch-on-mount: state is only set after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Always tries POST /api/rules first; stores locally if that endpoint does
  // not exist or the backend is down. Returns where it was saved.
  const saveRule = useCallback(
    async (rule) => {
      try {
        const result = await createRule(rule)
        if (result.available) {
          await load()
          return 'remote'
        }
      } catch {
        // fall through to local
      }
      const next = [...loadLocal(), rule]
      writeJson(STORAGE_KEYS.rules, next)
      setRules(next)
      setSource('local')
      return 'local'
    },
    [load],
  )

  const removeRule = useCallback((id) => {
    const next = loadLocal().filter((rule) => rule.id !== id)
    writeJson(STORAGE_KEYS.rules, next)
    setRules(next)
  }, [])

  const value = useMemo(() => ({ rules, source, loading, saveRule, removeRule }), [rules, source, loading, saveRule, removeRule])
  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>
}

