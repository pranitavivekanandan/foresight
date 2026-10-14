// Shared thresholds and polling intervals used across the dashboard and alerts UI.
// Centralized here so App.jsx, DashboardCard, and the alerts views stay in sync
// without each hardcoding the same numbers. predict.js keeps its own internal
// defaults (90/'memPercent') unchanged — these constants are for callers that
// previously passed the numbers as literals.
export const MEM_THRESHOLD_PERCENT = 90
export const CPU_THRESHOLD_PERCENT = 80

export const POLL_INTERVAL_MS = 30_000
