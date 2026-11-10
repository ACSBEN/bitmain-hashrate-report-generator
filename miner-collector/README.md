# Miner Collector (Part 2 — not started)

This will query running miners on the network and save the results as report files for the report manager.

Output contract: write one JSON file per miner snapshot into `../report-manager/data/reports/`, following [`docs/report-schema.md`](../docs/report-schema.md), with `"source": "api"`.
