# Plan: Threshold management section

## Context
Thresholds currently live only in `report-manager/config/thresholds.json` and must be hand-edited. The user wants a section in the app to manage them, including turning individual checks on and off. Decisions (from user):
- **Global + per-model:** each metric has a global on/off switch and warn/fail limits. A model can inherit the global setting, override the limits, or disable the metric for just that model.
- **Disabled checks:** the value still shows on the report but is never highlighted and doesn't affect the overall status. No "not checked" marker.
- **Model management:** add, rename and delete models, and set their expected hashrate, from the UI.

## Config format (backward compatible)
Keep the current shape. Add an optional `enabled` flag (missing = `true`), and let model entries hold partial metric overrides:
```json
{
  "default": {
    "avgChipTempC": { "enabled": true, "warn": 85, "fail": 95 },
    "llcTempDeltaC": { "enabled": false, "warn": 10, "fail": 15 }
  },
  "models": {
    "Antminer S21": {
      "expectedHashrateTHs": 200,
      "avgChipTempC": { "warn": 90, "fail": 100 },
      "pfcTempC": { "enabled": false }
    }
  }
}
```
- Limits are kept when a metric is disabled, so turning it back on restores them.
- The existing file keeps working unchanged.

## Changes

### `src/thresholds.js`
- Add a `METRICS` table that replaces `MAX_METRICS`: `{ key, label, unit, kind: 'minPct' | 'max', scope: 'miner+hashboards' | 'hashboards' | 'psu' }`. Labels are reused from `schema.js` field labels where possible. Both `evaluate` and the settings views iterate this table.
- `resolveLimits`: merge each metric's keys separately (`{ ...default[k], ...model[k] }`) instead of replacing the whole metric. This lets a model set only `{ enabled: false }`.
- New `off` status in `checkMax`/`checkHashrate` when `enabled === false`. It ranks the same as `na`, so it never raises the overall status. `report-body.ejs` needs no change: `off` gets no `st-warn`/`st-fail` class or flag.
- New `normalizeThresholds(input)` → `{ value, errors }`, the same pattern as `schema.normalizeReport`. It checks that:
  - warn and fail are finite numbers;
  - for `max` metrics, warn ≤ fail;
  - for `minPct` metrics, fail ≤ warn and both are 0–200;
  - model names are non-empty and unique (case-insensitive);
  - expected hashrate is > 0 or blank.
- New `saveThresholds(file, config)`, which writes atomically.

### `src/fs-util.js` (new)
Move the temp-file-plus-rename write out of `store.js` into `writeJsonAtomic(file, data)`. `store.js` and `thresholds.js` both use it.

### `src/routes/settings.js` (new; mounted in `src/app.js` alongside `routes/reports.js`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/settings/thresholds` | Global metrics table plus the model list |
| POST | `/settings/thresholds` | Save global metrics |
| POST | `/settings/thresholds/models` | Add a model (name and expected hashrate) |
| GET | `/settings/thresholds/models/:name/edit` | Model edit page |
| POST | `/settings/thresholds/models/:name` | Save the model (supports rename) |
| POST | `/settings/thresholds/models/:name/delete` | Delete the model |

- `:name` is URL-encoded and looked up case-insensitively, the same way as `findModelConfig`.
- Validation errors re-render the page with HTTP 422 and keep what you entered, the same as the report form.
- A successful save redirects with `?saved=1` and shows the existing `.notice`.

### Views
- **`views/thresholds.ejs`**
  - **Global card:** one row per metric showing label, an **Enabled** checkbox, Warn, Fail, and unit or "% of expected". Rows that are switched off are dimmed. A note explains the rules: temperatures above the limit are flagged, and hashrate below the given percent of expected is flagged.
  - **Models card:** a table of name, expected TH/s, number of overrides, Edit and Delete (with a confirm prompt), plus an inline "Add model" form.
- **`views/threshold-model.ejs`:** name, expected hashrate, and a row per metric with a mode select: **Use global** (shows the global values read-only), **Custom** (warn/fail inputs, enabled), or **Disabled**.
  - Saved as: no key / `{ enabled: true, warn, fail }` / `{ enabled: false }`.
  - **Custom** lets a model switch on a metric that is off globally.
  - A few lines of inline JS show or hide the warn/fail inputs; the page still works without JS.
- **`views/partials/header.ejs`:** add nav links for **Reports** and **Thresholds**.
- **`public/css/app.css`:** small additions: dimmed disabled rows and a compact settings table.

### Docs
Update the Thresholds section of `docs/report-schema.md` (the `enabled` flag, partial model overrides, the settings page) and the "Using it" section of `README.md`.

## Verification
- `npm test`. New and updated tests:
  - **`test/thresholds.test.js`:** a disabled global metric gives `off` and doesn't affect the overall status; a model disables one metric; a model turns on a metric that is off globally; partial overrides merge; `normalizeThresholds` rejects warn > fail, duplicate model names and non-numeric input.
  - **`test/settings.test.js`:** uses a temp copy of the config (`createApp({ thresholdsFile })`). It disables a metric through POST and checks that a report that used to fail now passes. It also checks add, rename and delete of a model, a 422 response that keeps the input, and that an unknown model gives 404.
- **Manual check:** `npm run seed && npm start`, open Thresholds, switch off "Average Chip Temp" globally, then confirm the FAIL board-3 chip cell on the S19j Pro sample is no longer flagged. Add a "Antminer S23" model with an expected hashrate of 330 and confirm the S23 sample now shows WARN. Screenshot the settings pages with headless Chromium.
