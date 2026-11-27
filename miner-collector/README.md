# Miner Collector

A local web app that pulls live data from a miner running **Vnish** firmware. It saves the data as a JSON snapshot, shows it on a screen grouped by component, and can turn it into a report for the report manager.

```bash
npm install
npm start        # http://127.0.0.1:3001
npm test
```

Set `PORT` or `HOST` to change the bind address. Set `REPORT_MANAGER_URL` if the report manager doesn't run on `http://127.0.0.1:3000`. The collector only uses that URL for links. Reports are written straight to `../report-manager/data/reports/`.

## How it works

1. Enter the miner's IP address. The collector calls every Vnish endpoint that works without auth, plus all 8 log types, in parallel with a 10 s timeout. See [`API/vnish-api.md`](../API/vnish-api.md).
2. The responses are normalized into one snapshot and saved to `data/snapshots/<serial>_<UTC timestamp>.json`. In the snapshot, keys are camelCase, hashrates are in TH/s, voltages are in V, and units are in the field names.
   - If one endpoint fails, its section is left blank and the failure is listed under `errors`.
   - If `/info` fails, nothing is saved.
3. The success screen shows these cards:
   - Overview
   - Each hashboard, with its sensors, factory info, chip health grid and chip table
   - PSU, Cooling, Pools, System & network, Tuning and Logs

   Until a report is created, the Overview card has a field for entering or fixing the serial number by hand. Some miners don't report one, and a report needs it. Saving sets `miner.serialNumberSource: "manual"`, keeps the old value in `miner.detectedSerialNumber`, and renames the snapshot file to match the new serial.
4. **Create report** maps the snapshot onto the [report schema](../docs/report-schema.md) and validates it with the report manager's own schema code. The mapping:
   - Miner hashrate = the average hashrate
   - Board hashrate = realtime, because the API has no per-board average
   - Board temps = the mean and max − min of the 4 on-board sensors
   - PSU LLC = the mean and difference of LLC1/LLC2
   - Run time = system uptime

   A snapshot creates at most one report.

## Layout

| Path | What it does |
|---|---|
| `src/vnish/client.js` | Validates the IP and fetches all endpoints and logs |
| `src/vnish/normalize.js` | Raw Vnish responses → snapshot |
| `src/to-report.js` | Snapshot → report-manager input |
| `src/snapshots.js` | Saves, reads and lists snapshot files |
| `src/routes.js` | Web routes |
| `test/fixtures/vnish/` | Real responses from an S21 Pro on Vnish 1.3.5, used by the tests |
