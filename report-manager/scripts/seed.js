'use strict';

// Writes sample reports for manual testing. Uses fixed ids, so re-running
// overwrites the samples instead of duplicating them.

const path = require('node:path');
const { createStore } = require('../src/store');

const store = createStore(path.join(__dirname, '..', 'data', 'reports'));

const board = (serialNumber, model, hashrateTHs, pcb, pcbDelta, chip, chipDelta) => ({
  serialNumber, model, hashrateTHs,
  avgPcbTempC: pcb, pcbTempDeltaC: pcbDelta, avgChipTempC: chip, chipTempDeltaC: chipDelta,
});

const samples = [
  {
    id: '6f1c2a3e-1b2c-4d5e-8f90-0a1b2c3d4e01',
    reportDate: '2026-11-02',
    notes: 'Healthy unit. Passed 24h burn-in.',
    miner: {
      serialNumber: 'YNAHD6BBDJJBA0142', model: 'Antminer S21', firmwareVersion: '2024-09-12 (Bitmain)',
      hashrateTHs: 201.4, runTimeSeconds: 3 * 86400 + 4 * 3600 + 12 * 60,
    },
    hashboards: [
      board('JYZZB1AB4206A0011', 'BHB68601', 67.3, 58, 4, 71, 5),
      board('JYZZB1AB4206A0012', 'BHB68601', 66.9, 59, 5, 72, 6),
      board('JYZZB1AB4206A0013', 'BHB68601', 67.2, 58, 4, 70, 5),
    ],
    psu: { pfcTempC: 52, avgLlcTempC: 55, llcTempDeltaC: 3 },
  },
  {
    id: '6f1c2a3e-1b2c-4d5e-8f90-0a1b2c3d4e02',
    reportDate: '2026-11-05',
    notes: 'Board 3 running hot with low hashrate. Check heatsink contact and fan airflow.',
    miner: {
      serialNumber: 'SMTTDCBBCJCBH0377', model: 'Antminer S19j Pro', firmwareVersion: '2023-07-04 (Bitmain)',
      hashrateTHs: 91.8, runTimeSeconds: 18 * 3600 + 40 * 60,
    },
    hashboards: [
      board('KAZZB0TB3112E0101', 'BHB42601', 33.9, 66, 8, 80, 9),
      board('KAZZB0TB3112E0102', 'BHB42601', 33.1, 70, 11, 84, 11),
      board('KAZZB0TB3112E0103', 'BHB42601', 24.8, 87, 16, 97, 17),
    ],
    psu: { pfcTempC: 71, avgLlcTempC: 82, llcTempDeltaC: 6 },
  },
  {
    id: '6f1c2a3e-1b2c-4d5e-8f90-0a1b2c3d4e03',
    reportDate: '2026-11-08',
    notes: 'Model not in threshold config yet; hashrate is not flagged. PSU LLC temps not recorded.',
    miner: {
      serialNumber: 'HTM3X0001ABC', model: 'Antminer S23', firmwareVersion: '',
      hashrateTHs: 310, runTimeSeconds: null,
    },
    hashboards: [
      board('', '', 103.2, 60, 5, 74, 6),
      board('', '', 103.5, 61, 5, 75, 6),
      board('', '', 103.3, 60, 4, 74, 5),
    ],
    psu: { pfcTempC: 58, avgLlcTempC: null, llcTempDeltaC: null },
  },
];

(async () => {
  for (const { id, ...data } of samples) {
    const report = await store.create(data, { id });
    console.log(`seeded ${report.miner.serialNumber} (${id})`);
  }
})().catch((err) => {
  console.error(err.errors || err);
  process.exit(1);
});
