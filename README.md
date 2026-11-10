# Bitmain Hashrate Report Generator

A locally hosted tool for recording miner diagnostics and producing printable per-miner hashrate and temperature reports.

| Directory | What it is |
|---|---|
| `report-manager/` | Node.js (Express + EJS) web app to create, view, edit, print and download reports |
| `miner-collector/` | *(planned)* Pulls live data from miners and writes report files |
| `docs/` | [Data schema](docs/report-schema.md) and project plans ([initial](docs/plan.md), [thresholds](docs/plan-thresholds.md)) |

## Quick start

Requires Node.js 20 or newer.

```bash
cd report-manager
npm install
npm run seed     # optional: load 3 sample reports
npm start        # http://127.0.0.1:3000
```

Other scripts: `npm run dev` restarts on file changes, and `npm test` runs the test suite. Set `PORT` or `HOST` to change the bind address. The app binds to localhost by default.

## Using it

- **New Report**: enter miner, hashboard (×3) and PSU data. Blank numeric fields mean "not recorded".
- **Report page**: values outside the thresholds are highlighted WARN or FAIL, and the report gets an overall status.
- **Print**: the Print button opens the browser print dialog, and the print layout fits on one page. To get a PDF, choose "Save as PDF".
- **Download HTML** saves a self-contained copy you can share. **Download JSON** saves the raw data.
- **Thresholds** page:
  - Switch each check on or off and set its warn/fail limits.
  - Manage models and their expected hashrates.
  - Override or disable individual checks for one model.
  - Changes apply immediately. The settings are stored in `report-manager/config/thresholds.json`. See [the schema doc](docs/report-schema.md#thresholds) for the format.

Reports are stored as JSON files in `report-manager/data/reports/`, which is gitignored.
