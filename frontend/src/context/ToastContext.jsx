import { useCallback, useMemo, useRef, useState } from 'react'
import { SIMULATED_MESSAGE, ToastContext } from './contexts'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const show = useCallback((message, tone = 'info') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const value = useMemo(
    () => ({ show, simulated: (action) => show(action ? `${SIMULATED_MESSAGE} (${action})` : SIMULATED_MESSAGE, 'simulated') }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <i className={`ti ${toast.tone === 'simulated' ? 'ti-flask' : toast.tone === 'error' ? 'ti-alert-triangle' : 'ti-check'}`} aria-hidden="true"></i>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

