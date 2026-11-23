'use strict';

const SNAPSHOT_VERSION = 1;

// Vnish hashrates (hr_*, hashrate_*) are GH/s; snapshots use TH/s.
const GH_PER_TH = 1000;

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  if (value === null) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function ghToTh(value) {
  const n = num(value);
  return n === null ? null : round(n / GH_PER_TH, 3);
}

// Factory EEPROM fields read "N/A" when the board can't be identified.
function text(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' || s.toUpperCase() === 'N/A' ? null : s;
}

function bool(value) {
  return typeof value === 'boolean' ? value : null;
}

function minMax(range) {
  return { min: num(range?.min), max: num(range?.max) };
}

/**
 * Parse Vnish's uptime string into seconds. Seen: "1:07" (H:MM). Also accepts
 * the Linux `uptime` forms "3 days, 4:05", "2 days" and "37 min". Anything
 * else returns null rather than guessing.
 */
function parseUptime(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  const m = s.match(/^(?:(\d+)\s*days?)?\s*,?\s*(?:(\d+):(\d{2})|(\d+)\s*min(?:s|utes?)?)?$/i);
  if (!s || !m || (m[1] === undefined && m[2] === undefined && m[4] === undefined)) return null;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const minutes = Number(m[3] ?? m[4] ?? 0);
  if (minutes >= 60 && m[3] !== undefined) return null;
  return days * 86400 + hours * 3600 + minutes * 60;
}

function normalizeChains({ summary, boards, factoryInfo }) {
  const summaryChains = summary?.miner?.chains || [];
  const boardList = Array.isArray(boards) ? boards : [];
  const factoryChains = factoryInfo?.chains || [];
  const ids = [...new Set([...summaryChains, ...boardList, ...factoryChains].map((c) => c.id))]
    .filter((id) => Number.isInteger(id))
    .sort((a, b) => a - b);

  return ids.map((id) => {
    const s = summaryChains.find((c) => c.id === id) || {};
    const b = boardList.find((c) => c.id === id) || {};
    const f = factoryChains.find((c) => c.id === id);
    return {
      id,
      slot: id - 1,
      state: s.status?.state ?? b.status?.state ?? null,
      stateDescription: s.status?.description ?? b.status?.description ?? null,
      frequencyMHz: round(num(s.frequency ?? b.freq), 1),
      // Chain voltage is reported in mV.
      voltageV: s.voltage === undefined ? null : round(num(s.voltage) / 1000, 3),
      powerW: num(s.power_consumption),
      hashrate: {
        realtimeTHs: ghToTh(s.hashrate_rt ?? b.hr_realtime),
        idealTHs: ghToTh(s.hashrate_ideal ?? b.hr_nominal),
        percentOfIdeal: num(s.hashrate_percentage),
        errorPct: num(s.hr_error),
      },
      hwErrors: num(s.hw_errors),
      pcbTempC: minMax(s.pcb_temp),
      chipTempC: minMax(s.chip_temp),
      chipStatuses: s.chip_statuses
        ? { red: num(s.chip_statuses.red), orange: num(s.chip_statuses.orange), grey: num(s.chip_statuses.grey) }
        : null,
      sensors: (b.sensors || []).map((sensor) => ({
        location: num(sensor.loc),
        state: sensor.state ?? null,
        pcbTempC: num(sensor.board),
        chipTempC: num(sensor.chip),
      })),
      chips: (b.chips || []).map((chip) => ({
        id: chip.id,
        grade: chip.grade ?? null,
        hashrateGHs: num(chip.hr),
        frequencyMHz: num(chip.freq),
        errors: num(chip.errs),
        throttled: bool(chip.throttled),
        // Always 0 on the S21 Pro, so treat 0 as "not reported".
        tempC: num(chip.temp) || null,
        voltageV: num(chip.volt) ? round(num(chip.volt) / 1000, 3) : null,
      })),
      factory: f
        ? {
          boardModel: text(f.board_model),
          serialNumber: text(f.serial),
          chipBin: num(f.chip_bin) || null,
          frequencyMHz: num(f.freq) || null,
          // EEPROM voltage is in 10 mV units (1438 -> 14.38 V).
          voltageV: num(f.volt) ? round(num(f.volt) / 100, 2) : null,
          hashrateTHs: ghToTh(f.hashrate) || null,
        }
        : null,
    };
  });
}

function camelKeys(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]),
  );
}

/**
 * Turn the raw Vnish responses from client.fetchAll() into a clean snapshot:
 * camelCase keys, explicit units in the names, TH/s for hashrates and V for
 * voltages. Sections whose endpoint failed come out null/empty, and the
 * failure is recorded in `errors`.
 */
function normalize({ host, raw, logs, errors }, { capturedAt = new Date().toISOString() } = {}) {
  const { info = null, model = null, status = null, summary = null, perfSummary = null,
    factoryInfo = null, notes = null, ui = null } = raw;
  const m = summary?.miner || {};
  const sys = info?.system || {};
  const net = sys.network_status || {};
  const temps = m.psu?.temps || {};
  const topology = model?.chain?.topology;

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    capturedAt,
    source: { firmware: 'vnish', host },
    miner: {
      model: text(info?.miner ?? model?.full_name),
      modelCode: text(info?.model ?? model?.model),
      serialNumber: text(info?.serial ?? model?.serial),
      firmware: {
        name: text(info?.fw_name),
        version: text(info?.fw_version),
        buildName: text(info?.build_name),
        buildTime: text(info?.build_time),
        buildUuid: text(info?.build_uuid),
      },
      algorithm: text(info?.algorithm ?? model?.algorithm),
      series: text(model?.series),
      platform: text(info?.platform ?? model?.platform),
      installType: text(info?.install_type ?? model?.install_type),
      chainCount: num(model?.chain?.num_chains),
      chipsPerChain: num(model?.chain?.chips_per_chain),
    },
    status: {
      state: status?.miner_state ?? m.miner_status?.miner_state ?? null,
      stateTimeSeconds: num(status?.miner_state_time ?? m.miner_status?.miner_state_time),
      throttledPct: num(status?.throttled ?? m.miner_status?.throttled),
      restartRequired: bool(status?.restart_required),
      rebootRequired: bool(status?.reboot_required),
      findMiner: bool(status?.find_miner),
      unlocked: bool(status?.unlocked),
      restartCount: num(m.restart_count),
    },
    performance: {
      hashrate: {
        averageTHs: ghToTh(m.hr_average),
        realtimeTHs: ghToTh(m.hr_realtime),
        nominalTHs: ghToTh(m.hr_nominal),
        // Factory figure: only covers boards whose EEPROM is readable.
        stockTHs: ghToTh(m.hr_stock ?? factoryInfo?.hr_stock),
        errorPct: num(m.hr_error),
      },
      powerW: num(m.power_consumption ?? m.power_usage),
      efficiencyJTH: round(num(m.power_efficiency), 2),
      hwErrors: num(m.hw_errors),
      hwErrorsPct: num(m.hw_errors_percent),
      devfeePct: num(m.devfee_percent),
      pcbTempC: minMax(m.pcb_temp),
      chipTempC: minMax(m.chip_temp),
      foundBlocks: num(m.found_blocks),
      bestShare: num(m.best_share),
    },
    hashboards: normalizeChains(raw),
    chipLayout: topology
      ? {
        rows: num(topology.num_rows),
        cols: num(topology.num_cols),
        chipsPerDomain: num(model.chain.chips_per_domain),
        // 0-based chip indexes, row by row (chip id = index + 1).
        grid: topology.chips,
      }
      : null,
    psu: {
      model: text(factoryInfo?.psu_model),
      serialNumber: text(factoryInfo?.psu_serial),
      pfcTempC: num(temps.pfc_temp),
      llc1TempC: num(temps.llc1_temp),
      llc2TempC: num(temps.llc2_temp),
      powerMetering: bool(m.psu?.psu_power_metering),
    },
    cooling: {
      fanCount: num(m.cooling?.fan_num),
      fanDutyPct: num(m.cooling?.fan_duty),
      mode: m.cooling?.settings?.mode?.name ?? null,
      modeParam: num(m.cooling?.settings?.mode?.param),
      fans: (m.cooling?.fans || []).map((fan) => ({
        id: fan.id,
        rpm: num(fan.rpm),
        maxRpm: num(fan.max_rpm),
        status: fan.status ?? null,
      })),
      limits: model?.cooling
        ? {
          minFanPwm: num(model.cooling.min_fan_pwm),
          targetTempMinC: num(model.cooling.min_target_temp),
          targetTempMaxC: num(model.cooling.max_target_temp),
          minFanCount: num(model.cooling.fan_min_count?.default),
        }
        : null,
    },
    pools: (m.pools || []).map((pool) => ({
      id: pool.id,
      url: pool.url ?? null,
      type: pool.pool_type ?? null,
      user: pool.user ?? null,
      tls: bool(pool.use_tls),
      status: pool.status ?? null,
      difficulty: pool.diff ?? null,
      accepted: num(pool.accepted),
      rejected: num(pool.rejected),
      stale: num(pool.stale),
      lastShareDifficulty: num(pool.ls_diff),
      lastShareTime: pool.ls_time ?? null,
      acceptedDifficulty: num(pool.diffa),
      pingMs: num(pool.ping),
    })),
    system: {
      os: text(sys.os),
      hostname: text(net.hostname),
      uptime: sys.uptime ?? null,
      uptimeSeconds: parseUptime(sys.uptime),
      timezone: text(ui?.timezone),
      memory: {
        totalKB: num(sys.mem_total),
        freeKB: num(sys.mem_free),
        freePct: num(sys.mem_free_percent),
        bufferKB: num(sys.mem_buf),
        bufferPct: num(sys.mem_buf_percent),
      },
      network: {
        mac: text(net.mac),
        dhcp: bool(net.dhcp),
        ip: text(net.ip),
        netmask: text(net.netmask),
        gateway: text(net.gateway),
        dns: Array.isArray(net.dns) ? net.dns : [],
      },
    },
    tuning: {
      preset: perfSummary?.current_preset
        ? {
          name: perfSummary.current_preset.name ?? null,
          label: perfSummary.current_preset.pretty ?? null,
          status: perfSummary.current_preset.status ?? null,
        }
        : null,
      presetSwitcher: camelKeys(perfSummary?.preset_switcher),
      overclockLimits: model?.overclock
        ? {
          // Overclock voltages are in 10 mV units, like the factory EEPROM.
          minVoltageV: num(model.overclock.min_voltage) / 100,
          maxVoltageV: num(model.overclock.max_voltage) / 100,
          defaultVoltageV: num(model.overclock.default_voltage) / 100,
          minFrequencyMHz: num(model.overclock.min_freq),
          maxFrequencyMHz: num(model.overclock.max_freq),
          defaultFrequencyMHz: num(model.overclock.default_freq),
          warnFrequencyMHz: num(model.overclock.warn_freq),
          maxPowerLimitW: num(model.overclock.max_power_limit),
        }
        : null,
    },
    notes: Array.isArray(notes) ? notes : [],
    logs,
    errors,
  };
}

module.exports = { normalize, parseUptime, SNAPSHOT_VERSION };
