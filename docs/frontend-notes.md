# Frontend Notes

Working notes on the `frontend/` app as it exists on `feature/alerts-ui`, written for turning into a UML diagram and for the Digital Assignment 3 writeup. Status in the user story table is based on reading the actual frontend and backend code, not on intent.

## 1. Files, components, and functions

### Entry point
- `src/main.jsx`: mounts `<App />` into `#root` inside `<StrictMode>`. No logic.

### App shell
- `src/App.jsx`: top-level component. Owns all cross-cutting state:
  - `containers` (polled container histories + predictions), `backendUnreachable`
  - `view` (`'dashboard'` or `'alerts'`, local state, no router)
  - `alerts` (polled alert list), `alertsUnreachable`, `selectedAlertId`, `detailResolving`, `alertActionError`
  - Fetches container histories via `getContainerHistory` (one call per configured container id, `Promise.allSettled`) and alerts via `getAlerts`, both on a 30 second `setInterval` (`POLL_INTERVAL_MS` from `constants.js`).
  - Computes `prediction`/`cpuPrediction` per container by calling `predictBreach` from `predict.js`.
  - Computes `hasActiveAlert` per container by checking `alerts` for an unresolved row whose `containerId` matches.
  - Renders `Sidebar`, then either the dashboard card grid or `AlertsFeed`/`AlertDetail` depending on `view` and `selectedAlertId`.

### Pure logic (no React, directly unit tested)
- `src/predict.js`: `predictBreach(data, field = 'memPercent', threshold = 90)`. Linear regression over `{minutesSinceFirstPoint, value}` pairs, returns slope, current value, whether a breach is projected, and minutes to breach. Unchanged in this feature (explicitly not touched per task instructions). Mirrored by the backend's own copy in `alertEvaluator.js` because alerts must fire even with no dashboard open.
- `src/trend.js`: `analyzeTrend(data, field = 'memPercent')`. Same regression approach, returns a `direction` of `'increasing' | 'decreasing' | 'stable'` based on a +-0.05 slope deadband.
- `src/alertsUtils.js` (new): `groupAlerts(alerts)` turns a flat alert list into `{root, children}` pairs using `groupedWith`; `filterAlertsByStatus(alerts, status)` filters by `resolved`. Kept separate from `AlertsFeed.jsx` so the grouping/filtering rules can be unit tested without rendering anything.
- `src/constants.js` (new): `MEM_THRESHOLD_PERCENT` (90), `CPU_THRESHOLD_PERCENT` (80), `POLL_INTERVAL_MS` (30000). Single source for numbers that used to be repeated as literals in `App.jsx` and `DashboardCard.jsx`.

### Data access
- `src/api.js`: all `fetch` calls live here.
  - `getContainerHistory(containerId, limit)`: `GET /api/stats/:id/history`.
  - `getAlerts()` (new): `GET /api/alerts`.
  - `resolveAlert(id)` (new): `PATCH /api/alerts/:id/resolve`.
  - `BackendUnreachableError`: thrown when `fetch` itself throws (server process down), used by every caller the same way.
  - `ContainerFetchError`: thrown by `getContainerHistory` on a non-OK HTTP status; the two new alert functions throw a plain `Error` on non-OK status instead of a dedicated class, matching the task's "reuse `BackendUnreachableError`" instruction without inventing a parallel error hierarchy for a single extra field (id).

### Components (`src/components/`)
- `Sidebar.jsx`: takes `view` and `onNavigate`. Dashboard and Alerts are real `<button>`s that call `onNavigate`. Rules and Settings are still inert placeholders (unchanged, nothing backs them).
- `DashboardCard.jsx`: renders one container's card (CPU/memory stats, `TrendChart`, prediction panel). New: shows a `badge critical` "Alert active" pill next to the container name when `hasActiveAlert` is true.
- `TrendChart.jsx`: pure presentational SVG line chart of CPU/memory over the fetched history window. Not touched.
- `AlertsFeed.jsx` (new): the alerts list page. Owns its own `statusFilter` ('active'/'resolved') and `expandedRootIds` state. Uses `groupAlerts`/`filterAlertsByStatus` from `alertsUtils.js` to compute what to render, then renders one row per root alert plus, when expanded, one indented row per child (`groupedWith` pointing at that root). Calls `resolveAlert` from `api.js` directly on the row's Resolve button and reports success back up via `onAlertsChanged`.
- `AlertDetail.jsx` (new): single-alert view. Shows `explanation`, a "breach in about N minutes" line (or "already breached"), and two cost cards (Restart, Upgrade) built from `costRestartUsd`/`costUpgradeUsd`, both explicitly labelled as estimates and showing "Estimate unavailable" when the backend's cost service has no price data (`null`).

### Styling
- `src/App.css`: all dashboard, sidebar, card, and (new) alerts-feed/alert-detail/cost-card styles, built on the existing dark CSS variables (`--card-bg`, `--border`, `--green`, `--amber`, `--red`, etc). No new color variables were introduced; the new UI reuses the existing `.badge.critical`/`.badge.healthy` classes.
- `src/index.css`: Vite's default light/dark page chrome. Not used by the actual app layout (`App.css` overrides `#root`/`body`); left as scaffolding from `create-vite`.

### Unused / dead code (found while reading, not touched)
- `src/mockData.js` (`MOCK_HISTORY`) is not imported anywhere in `src/`.
- `src/assets/hero.png`, `react.svg`, `vite.svg` are not referenced anywhere in `src/`.

### Tests (new)
- `src/predict.test.js`, `src/trend.test.js`: pure-function regression tests.
- `src/api.test.js`: `getAlerts`/`resolveAlert` error handling against a mocked `global.fetch`.
- `src/components/AlertsFeed.test.jsx`: grouping/expansion, empty state, Resolve PATCH call, with Testing Library.
- `src/setupTests.js`: imports `@testing-library/jest-dom` matchers; wired in as `vite.config.js`'s `test.setupFiles`.

### High-level relationships (for the UML diagram)
```
main.jsx -> App.jsx
App.jsx -> api.js (getContainerHistory, getAlerts, resolveAlert)
App.jsx -> predict.js (predictBreach)
App.jsx -> Sidebar.jsx, DashboardCard.jsx, AlertsFeed.jsx, AlertDetail.jsx
DashboardCard.jsx -> TrendChart.jsx, trend.js (analyzeTrend)
AlertsFeed.jsx -> alertsUtils.js (groupAlerts, filterAlertsByStatus), api.js (resolveAlert)
AlertDetail.jsx -> (pure props, no imports besides React)
constants.js -> App.jsx, DashboardCard.jsx
```

## 2. User stories: status

Status reflects what the code in this repo actually does on this branch, not the design intent. "Partial" means some of the behavior exists but not the full story as written.

| # | Priority | User story | Status | Evidence |
|---|----------|------------|--------|----------|
| 1 | Must | Auto-collect metrics | Done | `backend/poller.js` runs `collectAllContainerStats` + `metricsService.insertStats` on a `setInterval` (default 10s), started independently of any request. |
| 2 | Must | Overview of all services | Partial | Dashboard renders one card per id in `VITE_CONTAINER_IDS` (a build-time env var); `GET /api/stats/containers` exists on the backend to list all live containers but the frontend never calls it, so there is no runtime auto-discovered overview. |
| 3 | Must | Real-time updates | Done | `App.jsx` polls both container history and alerts every 30s (`POLL_INTERVAL_MS`); this is polling, not a push/websocket channel, but it does keep the UI current without a manual reload. |
| 4 | Must | Custom thresholds | Not built | Threshold is a single hardcoded/env-var number (`ALERT_THRESHOLD`, default 90, in `alertEvaluator.js`; `MEM_THRESHOLD_PERCENT`/`CPU_THRESHOLD_PERCENT` in the frontend). No database column, API, or UI to set a threshold per user or per container; `database/init.sql` has no thresholds table. |
| 5 | Must | Add/remove containers | Not built | The dashboard's container list is a static comma-separated env var read once at build time; no UI calls `GET /api/stats/containers` or offers add/remove. |
| 6 | Should | Forecast near-future value | Done | `predict.js`/`trend.js` project the next value and breach point from a linear regression over recent history. |
| 7 | Should | Predicted value overlay | Not built | `TrendChart.jsx` only plots the two actual series (CPU, memory); the forecast is shown as text in the prediction panel, never drawn on the chart itself. |
| 8 | Should | Predictive alerting | Done | `backend/services/alertEvaluator.js` runs the same regression against stored history and inserts a real alert row when a breach is projected. |
| 9 | Should | Group alerts by root cause | Done | `alertsService.findGroupCandidate` groups a new alert under an earlier unresolved alert from a different container within a time window; `AlertsFeed` renders that via `groupAlerts`. |
| 10 | Should | Plain-English explanation | Done | `alertEvaluator.buildExplanation` produces a sentence (e.g. "X's memPercent has been climbing steadily..."), stored as `explanation` and shown in both `AlertsFeed` and `AlertDetail`. |
| 11 | Should | Fallback when AI unavailable | Not built | There is no AI/LLM call anywhere in the codebase; `explanation` is a plain template string, not a model output, so there is nothing for this fallback to guard. |
| 12 | Should | Metric drill-down | Partial | Each dashboard card already shows a per-container CPU/memory chart, but there is no separate per-metric drill-down view (e.g. a longer time range or raw-value table for one metric). |
| 13 | Should | Acknowledge/dismiss alerts | Partial | Only one state transition exists: `PATCH /api/alerts/:id/resolve` sets `resolved = true`. There is no separate "acknowledge" vs "dismiss" semantics in the schema or API. |
| 14 | Could | Show cost of response options | Done | `AlertDetail` renders Restart and Upgrade cost cards from `costRestartUsd`/`costUpgradeUsd`, both labelled as estimates. |
| 15 | Could | Multiple response options with costs | Done | Two response options (Restart, Upgrade), each with its own cost, both sourced from `costService.getCosts()`. |
| 16 | Could | Configurable cost table | Partial | Instance tiers used for pricing (`COST_RESTART_TIER`, `COST_UPGRADE_FROM_TIER`, `COST_UPGRADE_TO_TIER`) are configurable via backend env vars, but there is no UI or API to change them at runtime. |
| 17 | Could | Reference related metrics | Not built | Neither `AlertsFeed` nor `AlertDetail` link a memory alert to related CPU/request-rate data; only the single triggering metric is shown. |
| 18 | Could | Prediction confidence | Not built | `predict.js`/`trend.js` return a slope and a point estimate only; no R-squared, confidence interval, or score is computed or surfaced anywhere. |
| 19 | Could | Ingestion status indicator | Not built | The only connectivity signal is the generic "Backend is unreachable" banner (process down), not an indicator of whether metric collection is current or lagging. |
| 20 | Could | Show underlying metrics in grouped alert | Done | Expanding a root row in `AlertsFeed` reveals each grouped child alert's own container, metric, and explanation. |
| 21 | Could | Cache repeated explanations | Not built | `buildExplanation` is a cheap template-string function recomputed on every evaluation tick; there is no cache, and nothing expensive (like an AI call) exists that would need one. |
| 22 | Won't | Anomaly detection without manual threshold | Not built | Matches intent: alerts fire purely off a fixed, configured threshold (`ALERT_THRESHOLD`), not statistical outlier/anomaly detection. |
| 23 | Won't | Adapt to daily patterns | Not built | Matches intent: the regression always runs over the most recent fixed-size window with no time-of-day or seasonality modeling. |
| 24 | Won't | Non-blocking prediction schedule | Not built | Matches intent in spirit: `alertEvaluator.startAlertPoller` is a plain `setInterval` + `await` loop on the main event loop, same mechanism as the stats poller; nothing dedicated (worker thread, job queue) was built for this, but ordinary Node `async`/`await` does not block other requests either. |
| 25 | Won't | Rule-based grouping logic | Done (contradicts the stated "Won't") | `alertsService.findGroupCandidate` groups alerts purely by a fixed rule: "unresolved alert from a different container within N minutes." That is rule-based grouping, which this story explicitly said would not be built. Worth a conscious decision on whether to keep, replace, or relabel this story. |

## 3. Frontend design of tests

The frontend tests are split the same way the code is: pure logic first, component behavior second, nothing end-to-end. `predict.test.js` and `trend.test.js` test the two regression functions directly with hand-built point series, including the exact arithmetic (a 3-point series with a known slope and intercept) rather than only checking the direction of the result, because both functions feed real alerting and dashboard decisions and a sign error would be easy to miss with looser assertions. `api.test.js` stubs `global.fetch` with Vitest and checks each of the three failure shapes a caller actually has to handle: the fetch call itself rejecting (`BackendUnreachableError`), the server responding with a non-OK status, and the server responding OK with an unexpected body shape. `AlertsFeed.test.jsx` is the one component test, and it deliberately avoids snapshotting the whole table; it asserts the three behaviors that matter for correctness (a child alert stays hidden until its root is expanded, the empty state renders when nothing matches the filter, and clicking Resolve issues a real PATCH call) using Testing Library queries rather than implementation details like state variables. Grouping and filtering logic was pulled out of `AlertsFeed.jsx` into `alertsUtils.js` specifically so those rules could be tested without rendering anything. What is not covered: `AlertDetail.jsx` has no dedicated test, and there is no test exercising `App.jsx`'s polling/view-switching wiring directly, so a regression in how those pieces are wired together would currently only surface through manual testing or the build.

## 4. Frontend maintainability

The app has no router and no state management library; all cross-page state lives in `App.jsx` and is passed down as props, which is still a reasonable choice at two pages (Dashboard, Alerts) but will need revisiting if more pages are added, since `App.jsx` is already the largest file in `src/` after this change. The split between pure computation (`predict.js`, `trend.js`, `alertsUtils.js`) and rendering (everything in `src/components/`) is the main thing keeping the components themselves small and testable, and new alert-related logic should keep following that pattern rather than growing inside JSX. `constants.js` removes two of the three places a threshold number used to be duplicated, but the backend keeps its own separate copy of the same default (`ALERT_THRESHOLD` in `alertEvaluator.js`), so the two sides can still drift; nothing in this change enforces that they match. `api.js` is a flat set of functions rather than a generated client, which keeps it readable but means each new endpoint is still hand-written, including its own error handling. Dead code (`mockData.js`, the unused asset files) and an inert Rules/Settings nav should be cleaned up or wired up before they're mistaken for working features by someone new to the codebase.

## 5. Frontend SRS requirements

The frontend's functional scope, as actually implemented, is narrower than the full product vision: it displays live CPU and memory history per pre-configured container, a linear-regression-based forecast of when a metric will cross a fixed threshold, and a predictive alerts feed with root-cause grouping, a plain-English explanation, and two costed remediation options, refreshed on a 30 second poll. Its non-functional requirements follow the existing dark-theme design system and are meant to degrade visibly rather than silently: every data-fetching path distinguishes "backend process unreachable" from "bad response" from "no data yet" and renders a specific message for each, and the alert and cost data explicitly label estimates as estimates rather than presenting them as billing fact. What the current frontend does not satisfy, and what an SRS reviewer should flag, is configurability: there is no way for an end user to add or remove a monitored container, set a custom threshold, or adjust the cost table without a rebuild and redeploy, which keeps several Must/Should-level stories (custom thresholds, add/remove containers, configurable cost table) at Not built or Partial despite the backend already exposing some of the data needed to support them.
