# Plan: Bitmain Hashrate Report Manager (Part 1)

## Context
The repo is empty (README only; Node v26.8.2 / npm 11.19.1 available). We're building a locally hosted Node.js site that stores per-miner diagnostic data and renders styled HTML reports you can view, edit, save and print. A separate collector (Part 2: live API calls to miners) is **out of scope**, but the data format we define here is the contract it will later write to. For now data is entered manually through forms.

Decisions (from user): **one miner per report**, **JSON files on disk**, **Express + EJS** server-rendered, **configurable thresholds** that highlight out-of-range values.

## Layout
```
report-manager/              # Part 1 (this work)
  package.json               # deps: express, ejs. scripts: start, dev (node --watch), test (node --test), seed
  server.js                  # app setup, binds 127.0.0.1:3000 (PORT env override)
  src/
    schema.js                # field definitions, normalize() + validate() (hand-written, no dep)
    store.js                 # JSON file CRUD in data/reports, atomic writes (tmp + rename)
    thresholds.js            # load config, evaluate(report) -> per-field ok|warn|fail
    format.js                # runtime seconds -> "3d 4h 12m", number formatting, units
    routes/reports.js        # all report routes
  views/
    layout.ejs, index.ejs, form.ejs, report.ejs, partials/
  public/
    css/app.css              # app chrome
    css/report.css           # report styling incl. @media print (A4/Letter, hides nav/buttons)
  config/thresholds.json
  data/reports/              # *.json, gitignored except .gitkeep
  scripts/seed.js            # writes a few sample reports (incl. some out-of-range values)
  test/*.test.js             # node:test
miner-collector/README.md    # Part 2 placeholder: points to the schema doc, nothing else
docs/report-schema.md        # the data contract for Part 2
```

## Data model (`data/reports/<id>.json`, id = `crypto.randomUUID()`)
```json
{
  "schemaVersion": 1,
  "id": "…", "createdAt": "ISO", "updatedAt": "ISO",
  "reportDate": "ISO", "source": "manual", "notes": "",
  "miner":  { "serialNumber": "", "model": "", "firmwareVersion": "",
              "hashrateTHs": 0, "runTimeSeconds": 0 },
  "hashboards": [   // exactly 3, slot 0..2
    { "slot": 0, "serialNumber": "", "model": "", "hashrateTHs": 0,
      "avgPcbTempC": 0, "pcbTempDeltaC": 0, "avgChipTempC": 0, "chipTempDeltaC": 0 }
  ],
  "psu": { "pfcTempC": 0, "avgLlcTempC": 0, "llcTempDeltaC": 0 }
}
```
- Units fixed in field names (TH/s, °C, seconds); run time entered as d/h/m in the form, stored as seconds.
- `schema.js` holds a single field-definition table (key, label, unit, type, required) used by validation, the form, and the report view so they never drift.
- Validation: miner serial + model required; numerics must be finite numbers (blank allowed = "not recorded", stored as `null`); exactly 3 hashboards. Errors re-render the form with messages and the user's input preserved.
- `source` = `"manual"` now, `"api"` later from Part 2. Store ignores/logs invalid files rather than crashing.

## Thresholds (`config/thresholds.json`)
```json
{
  "default": {
    "hashrateMinPct": { "warn": 95, "fail": 90 },     // % of expected
    "avgPcbTempC":   { "warn": 75, "fail": 85 },
    "pcbTempDeltaC": { "warn": 10, "fail": 15 },
    "avgChipTempC":  { "warn": 85, "fail": 95 },
    "chipTempDeltaC":{ "warn": 10, "fail": 15 },
    "pfcTempC":      { "warn": 80, "fail": 90 },
    "avgLlcTempC":   { "warn": 80, "fail": 90 },
    "llcTempDeltaC": { "warn": 10, "fail": 15 }
  },
  "models": { "Antminer S21": { "expectedHashrateTHs": 200 }, "...": {} }
}
```
Per-model entries override defaults. Hashboard expected hashrate = miner expected / 3. Unknown model → temps still evaluated, hashrate unflagged. Report shows colored cells plus an overall PASS / WARN / FAIL badge. Placeholder numbers — user to tune.

## Routes (`src/routes/reports.js`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List reports: serial, model, date, overall status; search by serial/model; newest first |
| GET | `/reports/new` | Blank form |
| POST | `/reports` | Create → redirect to view |
| GET | `/reports/:id` | Styled report + Print (`window.print()`), Edit, Download buttons |
| GET | `/reports/:id/edit` | Prefilled form |
| POST | `/reports/:id` | Update (bumps `updatedAt`) |
| POST | `/reports/:id/delete` | Delete (confirm in browser) |
| GET | `/reports/:id/download.html` | Standalone HTML (report.css inlined) for saving/sharing |
| GET | `/reports/:id/download.json` | Raw data |

`:id` validated as UUID before touching the filesystem (no path traversal).

## Report layout (`views/report.ejs`)
Header (title, report date, overall badge) → Miner section (serial, model, firmware, hashrate vs expected, runtime) → Hashboards table (3 columns, one per board, rows = fields) → PSU table → Notes. Print CSS: white background, no nav/buttons, fits one page, `page-break-inside: avoid` on sections.

## Implementation order
0. Create `docs/` and save this plan as `docs/plan.md` (alongside `docs/report-schema.md` later).
1. Scaffold `report-manager/` package, `.gitignore`, Express + EJS server, layout.
2. `schema.js` + `store.js` + tests.
3. `thresholds.js` + config + tests.
4. Form (new/edit) with validation round-trip.
5. Report view + print CSS + downloads.
6. Index list with search/status.
7. Seed script, `docs/report-schema.md`, `miner-collector/README.md`, root README update.

## Verification
- `cd report-manager && npm install && npm test` — unit tests for validate/normalize, store CRUD (temp dir), threshold evaluation (ok/warn/fail, model override, unknown model, null values).
- `npm run seed && npm start`, then open http://127.0.0.1:3000: list shows seeded reports with statuses; create a report via form (try invalid input → errors shown, input preserved); view it; edit and confirm `updatedAt` changes in the JSON file; print preview (Ctrl+P) shows clean single-page report; download HTML opens standalone with styling; delete removes the file.
- Use the `run` skill / browser to screenshot the report and print view.
