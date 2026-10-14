// Shared thresholds and polling intervals used across the dashboard and alerts UI.
// Centralized here so App.jsx, DashboardCard, and the alerts views stay in sync
// without each hardcoding the same numbers. predict.js keeps its own internal
// defaults (90/'memPercent') unchanged — these constants are for callers that
// previously passed the numbers as literals.
//
// MEM/CPU thresholds are now only the *defaults*: the screens read the active
// threshold from the saved alert rules via thresholdFor() in rules.js, and
// fall back to these when no rule covers a metric.
export const MEM_THRESHOLD_PERCENT = 90
export const CPU_THRESHOLD_PERCENT = 80

export const POLL_INTERVAL_MS = 30_000

// Mirrors the backend's default POLL_INTERVAL_MS (backend/index.js). The
// frontend cannot read the backend's env, so if that variable is changed this
// constant must be updated too. Used for "datapoints per hour" in the rule summary.
export const BACKEND_SAMPLE_INTERVAL_MS = 10_000

// Mirrors the backend's ALERT_MAX_LOOKAHEAD_MINUTES default: predict.js flags
// any positive slope as a breach, so the UI only counts a predicted breach as
// "at risk" when it is within this window, same as the backend alert evaluator.
export const PREDICTION_LOOKAHEAD_MINUTES = 1440

// The history endpoint caps `limit` at 1000 rows (statsController.getHistory).
export const HISTORY_MAX_LIMIT = 1000
export const DASHBOARD_HISTORY_LIMIT = 100

// A container is "reporting" if its latest reading is newer than this.
export const STALE_AFTER_MINUTES = 5

// TODO(cost-unit): confirm the unit of the backend's cost fields before the demo.
// Reading backend/services/costService.js, costRestartUsd looks like the price
// of one minute of t3.medium on-demand time and costUpgradeUsd looks like the
// t3.medium -> t3.large hourly difference over a 730 h (one month) window.
// Until that is confirmed these stay null and the UI shows "unit unconfirmed".
export const COST_RESTART_UNIT = null
export const COST_UPGRADE_UNIT = null

// Mirrors the backend's ALERT_HISTORY_POINTS default: the alert evaluator fits
// its regression over this many latest readings, so the alert detail screen
// reports its fit over the same window.
export const ALERT_HISTORY_POINTS = 20
