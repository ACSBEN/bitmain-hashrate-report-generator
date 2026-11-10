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

`report-manager/config/thresholds.json` controls PASS/WARN/FAIL highlighting. It is re-read on every request.

- `default`: limits that apply to every model.
  - `hashrateMinPct`: `{ warn, fail }`. A hashrate below this percent of expected warns or fails.
  - Temperature and delta keys: `{ warn, fail }`. A value strictly above the limit warns or fails.
- `models["<model name>"]`: `expectedHashrateTHs`, plus any of the default keys to override them for that model. The expected hashrate for each hashboard is the miner's expected hashrate ÷ 3.
- For a model with no entry, temperatures are still checked but hashrate is not flagged.

The shipped numbers are placeholders based on nominal specs. Tune them to your fleet.
