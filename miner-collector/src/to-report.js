'use strict';

const HASHBOARD_COUNT = 3;

function mean(values) {
  const nums = values.filter((v) => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function spread(values) {
  const nums = values.filter((v) => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.max(...nums) - Math.min(...nums);
}

function localDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firmwareLabel(fw) {
  return [fw.name, fw.version].filter(Boolean).join(' ') || null;
}

/**
 * Map a snapshot onto the report-manager input shape (docs/report-schema.md).
 * Board temps come from the 4 on-board sensors: average and max − min. The
 * Vnish API has no per-board average hashrate, so boards use realtime.
 */
function snapshotToReport(snapshot, { snapshotName } = {}) {
  const hashboards = Array.from({ length: HASHBOARD_COUNT }, (_, slot) => {
    const board = snapshot.hashboards.find((b) => b.slot === slot);
    if (!board) return {};
    const pcb = board.sensors.map((s) => s.pcbTempC);
    const chip = board.sensors.map((s) => s.chipTempC);
    return {
      serialNumber: board.factory?.serialNumber ?? null,
      model: board.factory?.boardModel ?? null,
      hashrateTHs: board.hashrate.realtimeTHs,
      avgPcbTempC: mean(pcb),
      pcbTempDeltaC: spread(pcb),
      avgChipTempC: mean(chip),
      chipTempDeltaC: spread(chip),
    };
  });

  const { psu } = snapshot;
  const llc = [psu.llc1TempC, psu.llc2TempC];

  return {
    reportDate: localDate(snapshot.capturedAt),
    source: 'api',
    notes: `Collected from ${snapshot.source.host} (Vnish API)`
      + (snapshotName ? `, snapshot ${snapshotName}` : '') + '.',
    miner: {
      serialNumber: snapshot.miner.serialNumber,
      model: snapshot.miner.model,
      firmwareVersion: firmwareLabel(snapshot.miner.firmware),
      hashrateTHs: snapshot.performance.hashrate.averageTHs,
      runTimeSeconds: snapshot.system.uptimeSeconds,
    },
    hashboards,
    psu: {
      pfcTempC: psu.pfcTempC,
      avgLlcTempC: mean(llc),
      llcTempDeltaC: spread(llc),
    },
  };
}

module.exports = { snapshotToReport };
