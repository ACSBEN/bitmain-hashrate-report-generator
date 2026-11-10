# Report Data Schema (v1)

This is the contract between the **report manager** (`report-manager/`) and anything that produces report data, including the future **miner collector** (`miner-collector/`).

Each report is one JSON file at `report-manager/data/reports/<id>.json`, where `<id>` is a lowercase UUID (v4). There is one report per miner, per snapshot.

```json
{
  "schemaVersion": 1,
  "id": "6f1c2a3e-1b2c-4d5e-8f90-0a1b2c3d4e02",
  "createdAt": "2026-11-09T21:13:00.000Z",
  "updatedAt": "2026-11-09T21:13:00.000Z",
  "reportDate": "2026-11-05",
  "source": "api",
  "notes": "",
  "miner": {
    "serialNumber": "SMTTDCBBCJCBH0377",
    "model": "Antminer S19j Pro",
    "firmwareVersion": "2023-07-04 (Bitmain)",
    "hashrateTHs": 91.8,
    "runTimeSeconds": 67200
  },
  "hashboards": [
    { "slot": 0, "serialNumber": "…", "model": "BHB42601", "hashrateTHs": 33.9,
      "avgPcbTempC": 66, "pcbTempDeltaC": 8, "avgChipTempC": 80, "chipTempDeltaC": 9 },
    { "slot": 1, "…": "…" },
    { "slot": 2, "…": "…" }
  ],
  "psu": { "pfcTempC": 71, "avgLlcTempC": 82, "llcTempDeltaC": 6 }
}
```

## Fields

| Path | Type | Unit | Required | Notes |
|---|---|---|---|---|
| `schemaVersion` | integer | | | Always `1` for now |
| `id` | UUID string | | yes | Must match the file name |
| `createdAt`, `updatedAt` | ISO 8601 datetime | | | Set by the report manager |
| `reportDate` | `YYYY-MM-DD` | | | Defaults to today. Full ISO datetimes are accepted and truncated to the date |
| `source` | `"manual"` \| `"api"` | | | Defaults to `"manual"`. The collector should write `"api"` |
| `notes` | string | | | Up to 5000 chars |
| `miner.serialNumber` | string | | **yes** | |
| `miner.model` | string | | **yes** | Matched case-insensitively against `config/thresholds.json` |
| `miner.firmwareVersion` | string | | | |
| `miner.hashrateTHs` | number ≥ 0 | TH/s | | |
| `miner.runTimeSeconds` | integer ≥ 0 | seconds | | |
| `hashboards` | array of exactly 3 | | | `slot` 0–2 = board 1–3 |
| `hashboards[].serialNumber`, `.model` | string | | | |
| `hashboards[].hashrateTHs` | number ≥ 0 | TH/s | | |
| `hashboards[].avgPcbTempC` | number | °C | | |
| `hashboards[].pcbTempDeltaC` | number ≥ 0 | °C | | Max − min across PCB sensors |
| `hashboards[].avgChipTempC` | number | °C | | |
| `hashboards[].chipTempDeltaC` | number ≥ 0 | °C | | Max − min across chip sensors |
| `psu.pfcTempC` | number | °C | | |
| `psu.avgLlcTempC` | number | °C | | |
| `psu.llcTempDeltaC` | number ≥ 0 | °C | | |

Any numeric field may be `null`, which means "not recorded". It shows as "—" and is not flagged by thresholds. Numeric strings such as `"58.2"` are accepted and converted to numbers.

## Writing reports from another process

- Write to a temp file in the same directory, then rename it to `<uuid>.json` so the report manager never reads a half-written file.
- The report manager validates every file when it reads it. Invalid files are skipped and logged with a warning; they never crash the app.
- No restart is needed. The list page reads the directory on every request.

## Thresholds

You can manage thresholds in the app under **Thresholds** (`/settings/thresholds`), or edit `report-manager/config/thresholds.json` by hand. The file is re-read on every request, so changes apply right away.

```json
{
  "default": {
    "hashrateMinPct": { "enabled": true, "warn": 95, "fail": 90 },
    "avgChipTempC":   { "enabled": true, "warn": 85, "fail": 95 },
    "llcTempDeltaC":  { "enabled": false, "warn": 10, "fail": 15 }
  },
  "models": {
    "Antminer S21": {
      "expectedHashrateTHs": 200,
      "avgChipTempC": { "enabled": true, "warn": 90, "fail": 100 },
      "pfcTempC": { "enabled": false }
    }
  }
}
```

- **`default`**: the global checks. There is one entry per metric: `hashrateMinPct`, `avgPcbTempC`, `pcbTempDeltaC`, `avgChipTempC`, `chipTempDeltaC`, `pfcTempC`, `avgLlcTempC` and `llcTempDeltaC`.
  - `hashrateMinPct`: hashrate below `warn` or `fail` percent of the expected hashrate is flagged.
  - Every other metric: a value strictly above `warn` or `fail` is flagged.
  - `enabled: false` turns the check off, but the limits are kept so they come back when you turn it on again. A missing `enabled` means `true`. A metric missing from the file entirely counts as off.
- **`models["<model name>"]`**: matched against a report's model name, ignoring case.
  - `expectedHashrateTHs` is the expected hashrate. Each hashboard is expected to produce a third of it. If a model has no entry, its hashrate isn't checked.
  - A metric key overrides the global entry one field at a time. For example, `{ "enabled": false }` turns the check off for this model only. `{ "enabled": true, "warn": …, "fail": … }` sets custom limits, and also turns the check on for this model if it is off globally.
- **Disabled checks**: the value still appears on the report. It is never highlighted and doesn't affect the overall PASS/WARN/FAIL status.
- **Validation**:
  - Every enabled check needs both limits.
  - For temperatures, warn must be ≤ fail. For hashrate, fail % must be ≤ warn %, and both must be 0–200.
  - Model names must be unique, ignoring case.

The shipped numbers are placeholders based on nominal specs. Tune them to your fleet.
