# Vnish Firmware API Reference

Generated from the OpenAPI spec served by a Vnish miner at `http://<miner-ip>/docs/api-doc.json` (Swagger UI at `http://<miner-ip>/docs/`). The sample responses below were captured on 2026-11-23 from an **Antminer S21 Pro running Vnish 1.3.5** (`192.168.0.103`).

- **Spec**: xminer-api v0.1.0 (anthill.farm)
- **Base URL**: `http://<miner-ip>/api/v1`
- **Operations**: 46; **schemas**: 114

## Authentication

Two schemes are accepted on protected routes:

- **API key**: header `x-api-key: <key>`. Keys are managed via `/apikeys` (which itself needs auth).
- **Bearer JWT**: `POST /unlock` with `{"pw": "<web password>"}` returns a token; send it as `Authorization: Bearer <token>`.

The **Auth** column below means:

- **none**: public. No credentials are needed.
- **optional**: works without credentials. With credentials, some fields may be unmasked (e.g. the pool user).
- **required**: returns `401` without credentials.

`UnlockScreenBody`:

| Field | Type | Req | Description |
|---|---|---|---|
| `pw` | string | yes | Target device(s) password |

## Endpoint index

| Method | Path | Summary | Tag | Auth |
|---|---|---|---|---|
| POST | `/activate-warranty` | Warranty activate | warranty | required |
| GET | `/apikeys` | Get apikeys | apikeys | required |
| POST | `/apikeys` | Add api key | apikeys | required |
| POST | `/apikeys/delete` | Delete api key | apikeys | required |
| GET | `/auth-check` | Auth Check | auth | required |
| GET | `/autotune/presets` | Get autotune preset list | autotune | required |
| POST | `/autotune/reset` | Autotune reset list of profiles | autotune | required |
| POST | `/autotune/reset-all` | Autotune reset all profiles | autotune | required |
| GET | `/boards` | Get miner boards | other | none |
| POST | `/cancel-warranty` | Warranty cancel | warranty | required |
| GET | `/chains/factory-info` | Get miner boards factory info | other | none |
| POST | `/find-miner` | Find miner | other | none |
| POST | `/firmware/remove` | Remove firmware and boot from stock | firmware | required |
| POST | `/firmware/update` | Update firmware | firmware | required |
| GET | `/info` | Get miner info | other | none |
| POST | `/locate-miner` | Locate miner | other | none |
| POST | `/lock` | Lock miner | auth | required |
| POST | `/lock/others` | Lock other miner sessions | auth | required |
| GET | `/logs/{log_type}` | Read log file | logs | none |
| POST | `/logs/{log_type}/clear` | Clear logs | logs | required |
| GET | `/metrics` | Get metrics | metrics | none |
| POST | `/mining/pause` | Mining pause | mining | required |
| POST | `/mining/restart` | Mining restart | mining | required |
| POST | `/mining/resume` | Mining resume | mining | required |
| POST | `/mining/start` | Mining start | mining | required |
| POST | `/mining/stop` | Mining stop | mining | required |
| POST | `/mining/switch-pool` | Mining switch pool | mining | required |
| POST | `/mining/throttle` | Update throttle settings | mining | required |
| GET | `/model` | Get miner model info | other | none |
| GET | `/notes` | Read all notes | notes | none |
| POST | `/notes` | Add note | notes | required |
| GET | `/notes/{note}` | Get one note json | notes | none |
| PUT | `/notes/{note}` | Update notes | notes | required |
| DELETE | `/notes/{note}` | Delete note | notes | required |
| GET | `/perf-summary` | Summary | other | none |
| POST | `/rescan-hardware` | Rescan hardware | other | required |
| GET | `/settings` | Get all miner settings | settings | required |
| POST | `/settings` | Save miner settings | settings | required |
| POST | `/settings/backup` | Settings backup | settings | required |
| POST | `/settings/factory-reset` | Settings factory reset | settings | required |
| POST | `/settings/restore` | Settings restore | settings | required |
| GET | `/status` | Get status | other | none |
| GET | `/summary` | Summary | other | optional |
| POST | `/system/reboot` | System reboot | system | required |
| GET | `/ui` | UI | other | none |
| POST | `/unlock` | Auth Check | auth | none |

## Gotchas (observed on real hardware)

- **Hashrate units are GH/s.** See `info.hr_measure`. Divide by 1000 for TH/s. `summary.miner.average_hashrate` and `instant_hashrate` are already in TH/s. The `hr_*` fields are in GH/s.
- **Per-chip `temp` and `volt` in `/boards` are `0`** on the S21 Pro. Use the 4 per-board `sensors[]` (each one has `board` = PCB °C and `chip` = chip °C) or `summary.miner.chains[].pcb_temp/chip_temp` (min/max).
- **`/chains/factory-info` returns `"N/A"`** for the board model and serial when a board's EEPROM cannot be read. `hr_stock` then only sums the readable boards, so don't use it as the miner's expected hashrate.
- **Chain IDs are 1-based** (`1..3`). Report slots are 0-based.
- **Voltage units differ by endpoint.** `summary.miner.chains[].voltage` is in mV (`13064` = 13.064 V). `chains/factory-info` `volt` and the `model.overclock` voltages are in 10 mV units (`1438` = 14.38 V).
- **`info.system.uptime` is a string**, e.g. `"1:07"` (H:MM). `status.miner_state_time` is in seconds since the last state change.
- **`/summary` works without auth**, even though the spec lists security for it (it is optional). The pool `user` is masked (`*****`).
- **`/logs/{log_type}` returns `text/plain`**, not JSON. `*` (all logs) is not implemented for this route. The `pool` log can be over 100 KB.
- **Chip grade** (`grey` / `orange` / `red`) is the per-chip health colour used in the Vnish UI. `grey` means normal. `summary.miner.chains[].chip_statuses` gives the counts.
- **Chip layout**: `model.chain.topology.chips` is a `num_rows × num_cols` grid of 0-based chip indexes. Chip `id` in `/boards` is 1-based.

## Endpoints

### POST `/activate-warranty`

Warranty activate. Auth: **required**. Tag: warranty.

**200**: Warranty was successfully activated (`application/json`, WarrantyStatus)

| Field | Type | Req | Description |
|---|---|---|---|
| `success` | boolean | yes |  |
| `warranty` | enum: `active`, `inactive`, `expired`, `cancelled`, `not_provided` |  |  |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/apikeys`

Get apikeys. Auth: **required**. Tag: apikeys.

**200**: Api key list read successfully (`application/json`)

| Field | Type | Req | Description |
|---|---|---|---|
| `description` | string | yes |  |
| `key` | string | yes |  |

**401**: Unauthorized

### POST `/apikeys`

Add api key. Auth: **required**. Tag: apikeys.

**Request body** (`application/json`, AddApikeyQuery)

| Field | Type | Req | Description |
|---|---|---|---|
| `description` | string | yes |  |
| `key` | string | yes |  |

**200**: Api key was added successfully (`application/json`, AddApiKeyRes)

| Field | Type | Req | Description |
|---|---|---|---|
| `status` | enum: `inserted`, `updated`, `nochanges` | yes |  |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/apikeys/delete`

Delete api key. Auth: **required**. Tag: apikeys.

**Request body** (`application/json`, DeleteApikeyQuery)

| Field | Type | Req | Description |
|---|---|---|---|
| `key` | string | yes |  |

**200**: Key deleted successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/auth-check`

Auth Check. Auth: **required**. Tag: auth.

**200**: Authorized (`application/json`, AuthCheck)

| Field | Type | Req | Description |
|---|---|---|---|
| `unlock_timeout` | integer (nullable) (int64) |  |  |

**401**: Unauthorized (`application/json`, AuthCheck)

### GET `/autotune/presets`

Get autotune preset list. Auth: **required**. Tag: autotune.

**200**: Autotune preset list read successfully (`application/json`)

| Field | Type | Req | Description |
|---|---|---|---|
| `name` | string | yes | Preset id name |
| `pretty` | string | yes | Preset human-readable name |
| `status` | enum: `untuned`, `tuned` | yes | Preset status. `tuned` means that preset tuned successfully |
| `tune_settings` | object (nullable) |  |  |
| `tune_settings.chains` | array of object | yes |  |
| `tune_settings.chains[].chips` | array of integer (int32) | yes |  |
| `tune_settings.chains[].freq` | integer (int32) | yes |  |
| `tune_settings.chains[].serial` | string (nullable) |  |  |
| `tune_settings.date` | string (nullable) |  |  |
| `tune_settings.freq` | integer (int32) | yes |  |
| `tune_settings.hashrate` | integer (int32) | yes |  |
| `tune_settings.modified` | boolean | yes |  |
| `tune_settings.volt` | integer (int32) | yes |  |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/autotune/reset`

Autotune reset list of profiles. Auth: **required**. Tag: autotune.

**Request body** (`application/json`, AutotuneReset)

| Field | Type | Req | Description |
|---|---|---|---|
| `presets` | array of string | yes | List of presets to reset |
| `restart` | boolean | yes | Restart after presets remove |

**200**: Reset list of autotune profiles done successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/autotune/reset-all`

Autotune reset all profiles. Auth: **required**. Tag: autotune.

**Request body** (`application/json`, AutotuneResetAll)

| Field | Type | Req | Description |
|---|---|---|---|
| `restart` | boolean | yes |  |

**200**: Reset all autotune profiles done successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/boards`

Get miner boards. Auth: **none**. Tag: other.

**200**: Boards read successfully (`application/json`)

| Field | Type | Req | Description |
|---|---|---|---|
| `chips` | array of object | yes |  |
| `chips[].errs` | integer (int32) | yes |  |
| `chips[].freq` | integer (int32) | yes |  |
| `chips[].grade` | enum: `grey`, `orange`, `red` | yes |  |
| `chips[].hr` | number (float) | yes |  |
| `chips[].id` | integer | yes |  |
| `chips[].temp` | number (float) | yes |  |
| `chips[].throttled` | boolean | yes |  |
| `chips[].volt` | integer (int32) | yes |  |
| `freq` | number (float) | yes |  |
| `hr_nominal` | number (float) | yes |  |
| `hr_realtime` | number (float) | yes |  |
| `id` | integer | yes |  |
| `sensors` | array of object | yes |  |
| `sensors[].board` | integer (int32) | yes |  |
| `sensors[].chip` | integer (int32) | yes |  |
| `sensors[].loc` | integer (int32) | yes | Location that refers to `chip.id` |
| `sensors[].state` | enum: `init`, `ready`, `measure`, `error`, `unknown` | yes |  |
| `status` | object | yes |  |
| `status.failure_message` | string (nullable) |  |  |
| `status.state` | enum: `initializing`, `mining`, `stopped`, `failure`, `disconnected`, `disabled`, `unknown` | yes |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
[
  {
    "id": 1,
    "status": {
      "state": "mining"
    },
    "hr_realtime": 50627.8,
    "hr_nominal": 56169.359,
    "freq": 423.6,
    "sensors": [
      {
        "state": "measure",
        "board": 49,
        "chip": 64,
        "loc": 18
      },
      {
        "state": "measure",
        "board": 32,
        "chip": 47,
        "loc": 5
      },
      {
        "state": "measure",
        "board": 50,
        "chip": 65,
        "loc": 48
      },
      "\u2026 1 more"
    ],
    "chips": [
      {
        "id": 1,
        "hr": 693.0,
        "freq": 379,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 2,
        "hr": 861.3,
        "freq": 446,
        "volt": 0,
        "temp": 0.0,
        "errs": 3,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 3,
        "hr": 876.1,
        "freq": 447,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      "\u2026 62 more"
    ]
  },
  {
    "id": 2,
    "status": {
      "state": "mining"
    },
    "hr_realtime": 54492.796,
    "hr_nominal": 59945.398,
    "freq": 452.07693,
    "sensors": [
      {
        "state": "measure",
        "board": 50,
        "chip": 65,
        "loc": 18
      },
      {
        "state": "measure",
        "board": 34,
        "chip": 49,
        "loc": 5
      },
      {
        "state": "measure",
        "board": 48,
        "chip": 63,
        "loc": 48
      },
      "\u2026 1 more"
    ],
    "chips": [
      {
        "id": 1,
        "hr": 929.4,
        "freq": 466,
        "volt": 0,
        "temp": 0.0,
        "errs": 1,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 2,
        "hr": 877.3,
        "freq": 465,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 3,
        "hr": 835.7,
        "freq": 450,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      "\u2026 62 more"
    ]
  },
  {
    "id": 3,
    "status": {
      "state": "mining"
    },
    "hr_realtime": 46861.898,
    "hr_nominal": 52372.921,
    "freq": 394.96924,
    "sensors": [
      {
        "state": "measure",
        "board": 46,
        "chip": 61,
        "loc": 18
      },
      {
        "state": "measure",
        "board": 31,
        "chip": 46,
        "loc": 5
      },
      {
        "state": "measure",
        "board": 44,
        "chip": 59,
        "loc": 48
      },
      "\u2026 1 more"
    ],
    "chips": [
      {
        "id": 1,
        "hr": 947.3,
        "freq": 430,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 2,
        "hr": 662.0,
        "freq": 385,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      {
        "id": 3,
        "hr": 724.5,
        "freq": 413,
        "volt": 0,
        "temp": 0.0,
        "errs": 0,
        "grade": "grey",
        "throttled": false
      },
      "\u2026 62 more"
    ]
  }
]
```

</details>

### POST `/cancel-warranty`

Warranty cancel. Auth: **required**. Tag: warranty.

**200**: Warranty canceled successfully, or was not provided (`application/json`, WarrantyStatus)

| Field | Type | Req | Description |
|---|---|---|---|
| `success` | boolean | yes |  |
| `warranty` | enum: `active`, `inactive`, `expired`, `cancelled`, `not_provided` |  |  |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/chains/factory-info`

Get miner boards factory info. Auth: **none**. Tag: other.

**200**: Boards factory info read successfully (`application/json`, FactoryInfoReply)

| Field | Type | Req | Description |
|---|---|---|---|
| `chains` | array (nullable) |  |  |
| `chains[].board_model` | string | yes |  |
| `chains[].chip_bin` | integer (int32) | yes |  |
| `chains[].freq` | integer (int32) | yes |  |
| `chains[].hashrate` | number (double) | yes |  |
| `chains[].id` | integer (int32) | yes |  |
| `chains[].serial` | string | yes |  |
| `chains[].volt` | integer (int32) | yes |  |
| `has_pics` | boolean (nullable) |  |  |
| `hr_stock` | number (nullable) (double) |  |  |
| `psu_model` | string (nullable) |  |  |
| `psu_serial` | string (nullable) |  |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "hr_stock": 79029.59999999999,
  "has_pics": false,
  "psu_model": "PW380X1215GA-c",
  "psu_serial": "OLTT380BDAJBC0980",
  "chains": [
    {
      "id": 1,
      "board_model": "N/A",
      "serial": "N/A",
      "chip_bin": 0,
      "freq": 0,
      "volt": 0,
      "hashrate": 0.0
    },
    {
      "id": 2,
      "board_model": "N/A",
      "serial": "N/A",
      "chip_bin": 0,
      "freq": 0,
      "volt": 0,
      "hashrate": 0.0
    },
    {
      "id": 3,
      "board_model": "A3HB70601",
      "serial": "SMTTYSCBDJFAA01M9",
      "chip_bin": 1,
      "freq": 596,
      "volt": 1438,
      "hashrate": 79029.59999999999
    }
  ]
}
```

</details>

### POST `/find-miner`

Find miner. Auth: **none**. Tag: other.

**200**: Request handled successfully (`application/json`)

| Field | Type | Req | Description |
|---|---|---|---|
| `on` | boolean | yes | Locate miner on/off |

### POST `/firmware/remove`

Remove firmware and boot from stock. Auth: **required**. Tag: firmware.

**Request body** (`application/json`, FwRemoveParams)

| Field | Type | Req | Description |
|---|---|---|---|
| `remove_stock_logs` | boolean | yes |  |

**200**: Firmware was successfully removed. System will reboot after (`application/json`, RebootAfter)

| Field | Type | Req | Description |
|---|---|---|---|
| `after` | integer (int64) | yes | Number of seconds after the system will reboot By default, is 3 seconds |

**400**: This model has no 'remove firmware' (`application/json`, ErrDescr)

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/firmware/update`

Update firmware. Auth: **required**. Tag: firmware.

**Request body** (`multipart/form-data`, SchemaFirmwareUpdate)

| Field | Type | Req | Description |
|---|---|---|---|
| `file` | string (binary) | yes |  |
| `keep_settings` | enum: `true`, `false` (nullable) |  |  |

**200**: Firmware update successfully. System will reboot after (`application/json`, RebootAfter)

| Field | Type | Req | Description |
|---|---|---|---|
| `after` | integer (int64) | yes | Number of seconds after the system will reboot By default, is 3 seconds |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/info`

Get miner info. Auth: **none**. Tag: other.

**200**: Miner Info (`application/json`, InfoJson)

| Field | Type | Req | Description |
|---|---|---|---|
| `build_name` | string |  |  |
| `build_time` | string | yes | Build time |
| `build_uuid` | string |  |  |
| `fw_name` | string | yes | Firmware name |
| `fw_version` | string | yes | Firmware version |
| `install_type` | enum: `sd`, `nand` | yes | Install type code sd\|nand |
| `platform` | enum: `aml`, `bb`, `cv`, `stm`, `xil` | yes |  |
| `algorithm` | enum: `sha256d`, `scrypt`, `unknown` | yes |  |
| `hr_measure` | enum: `GH/s`, `MH/s`, `N/A` | yes | Hashrate measure unit |
| `miner` | string | yes | Pretty miner name |
| `model` | string | yes | Miner model code |
| `serial` | string | yes |  |
| `system` | object | yes |  |
| `system.mem_buf` | integer (int32) | yes |  |
| `system.mem_buf_percent` | integer (int32) | yes |  |
| `system.mem_free` | integer (int32) | yes |  |
| `system.mem_free_percent` | integer (int32) | yes |  |
| `system.mem_total` | integer (int32) | yes |  |
| `system.file_system_version` | string | yes |  |
| `system.miner_name` | string | yes |  |
| `system.network_status` | object | yes |  |
| `system.network_status.dhcp` | boolean (nullable) |  |  |
| `system.network_status.dns` | array of string | yes |  |
| `system.network_status.gateway` | string | yes |  |
| `system.network_status.hostname` | string | yes |  |
| `system.network_status.ip` | string | yes |  |
| `system.network_status.mac` | string | yes |  |
| `system.network_status.netmask` | string | yes |  |
| `system.os` | string | yes |  |
| `system.uptime` | string | yes |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "miner": "Antminer S21 Pro",
  "model": "s21pro",
  "fw_name": "Vnish",
  "fw_version": "1.3.5",
  "build_uuid": "e35db45e-5ebe-43df-8311-827cf5d6fc07",
  "build_name": "vnishru",
  "platform": "aml",
  "install_type": "nand",
  "build_time": "2026-07-30 09:23:35",
  "algorithm": "sha256d",
  "hr_measure": "GH/s",
  "system": {
    "os": "GNU/Linux",
    "miner_name": "s21pro",
    "file_system_version": "",
    "mem_total": 243704,
    "mem_free": 160420,
    "mem_free_percent": 65,
    "mem_buf": 45820,
    "mem_buf_percent": 18,
    "network_status": {
      "mac": "02:BF:73:EB:42:FB",
      "dhcp": true,
      "ip": "192.168.0.103",
      "netmask": "255.255.255.0",
      "gateway": "192.168.0.1",
      "dns": [
        "192.168.0.1"
      ],
      "hostname": "Antminer"
    },
    "uptime": "1:07"
  },
  "serial": "PIEMFKUBDJHJG00KG"
}
```

</details>

### POST `/locate-miner`

Locate miner. Auth: **none**. Tag: other.

**200**: Request handled successfully (`application/json`, LocateMinerStatus)

| Field | Type | Req | Description |
|---|---|---|---|
| `is_enabled` | boolean | yes | Locate miner on/off |

### POST `/lock`

Lock miner. Auth: **required**. Tag: auth.

**200**: Session dropped

**401**: Unauthorized

### POST `/lock/others`

Lock other miner sessions. Auth: **required**. Tag: auth.

**Request body** (`application/json`, UnlockScreenBody)

| Field | Type | Req | Description |
|---|---|---|---|
| `pw` | string | yes | Target device(s) password |

**200**: Other sessions dropped

**400**: Wrong password

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/logs/{log_type}`

Read log file. Auth: **none**. Tag: logs.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `log_type` | path | enum: `status`, `miner`, `autotune`, `pool`, `hwscan`, `system`, `messages`, `api`, `*` | yes | Log type name. All logs `*` are not implemented for this route |

**200**: Log file was read successfully

**500**: Internal Server Error (`application/json`, ErrDescr)

<details><summary>Sample response (`/logs/status`, first lines)</summary>

```text
[2015/01/01 00:00:38] INFO: Initializing [Antminer S21 Pro Amlogic (1.3.5)]
[2015/01/01 00:00:42] INFO: Cooling down the miner
[2026/11/23 01:54:44] INFO: Cooling down completed
[2026/11/23 01:54:52] INFO: Restarting (1 of 3) - Miner initialization failed
[2026/11/23 01:54:52] INFO: Mining stopped
[2026/11/23 01:55:06] INFO: Initializing [Antminer S21 Pro Amlogic (1.3.5)]
```

</details>

### POST `/logs/{log_type}/clear`

Clear logs. Auth: **required**. Tag: logs.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `log_type` | path | enum: `status`, `miner`, `autotune`, `pool`, `hwscan`, `system`, `messages`, `api`, `*` | yes | Log type |

**200**: Logs was cleared successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/metrics`

Get metrics. Auth: **none**. Tag: metrics.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `time_slice` | query | integer (int32) |  | Amount of seconds until now. Max is 3 days (3 * 24 * 60 * 60) Default is 1 day (24 * 60 * 60) |
| `step` | query | integer (int32) |  | Resample step in seconds to count average, default is 15 min (15 * 60) |

**200**: Config saved successfully (`application/json`, MetricsReply)

| Field | Type | Req | Description |
|---|---|---|---|
| `annotations` | array of object | yes |  |
| `annotations[].data` | object | yes |  |
| `annotations[].data.board_id` | integer (nullable) (int32) |  |  |
| `annotations[].data.type` | enum: `start`, `stop`, `restart`, `reboot`, `overheat`, `disable_board`, `enable_board`, `fw_update` | yes |  |
| `annotations[].time` | integer (int64) | yes | UNIX time |
| `metrics` | array of object | yes |  |
| `metrics[].data` | object | yes |  |
| `metrics[].data.chip_max_temp` | integer (int32) | yes |  |
| `metrics[].data.fan_duty` | integer (int32) | yes |  |
| `metrics[].data.hashrate` | number (double) | yes |  |
| `metrics[].data.pcb_max_temp` | integer (int32) | yes |  |
| `metrics[].data.power_consumption` | integer (int32) | yes |  |
| `metrics[].time` | integer (int64) | yes | UNIX time |
| `timezone` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` | yes | Current timezone name (code) |

**500**: Internal Server Error (`application/json`, ErrDescr)

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "timezone": "GMT",
  "metrics": [
    {
      "time": 1795468974,
      "data": {
        "hashrate": 151.268,
        "pcb_max_temp": 51,
        "chip_max_temp": 66,
        "fan_duty": 34,
        "power_consumption": 2090
      }
    },
    {
      "time": 1795468500,
      "data": {
        "hashrate": 145.88,
        "pcb_max_temp": 49,
        "chip_max_temp": 64,
        "fan_duty": 31,
        "power_consumption": 1985
      }
    },
    {
      "time": 1795467600,
      "data": {
        "hashrate": 147.182,
        "pcb_max_temp": 50,
        "chip_max_temp": 65,
        "fan_duty": 31,
        "power_consumption": 2004
      }
    },
    "\u2026 94 more"
  ],
  "annotations": [
    {
      "time": 1795464889,
      "data": {
        "type": "reboot"
      }
    },
    {
      "time": 1795398896,
      "data": {
        "type": "restart"
      }
    }
  ]
}
```

</details>

### POST `/mining/pause`

Mining pause. Auth: **required**. Tag: mining.

**200**: Mining paused

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/restart`

Mining restart. Auth: **required**. Tag: mining.

**200**: Mining restart

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/resume`

Mining resume. Auth: **required**. Tag: mining.

**200**: Mining resumed

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/start`

Mining start. Auth: **required**. Tag: mining.

**200**: Mining started

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/stop`

Mining stop. Auth: **required**. Tag: mining.

**200**: Mining stopped

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/switch-pool`

Mining switch pool. Auth: **required**. Tag: mining.

**Request body** (`application/json`, SwitchPoolQuery)

| Field | Type | Req | Description |
|---|---|---|---|
| `pool_id` | integer (int32) | yes |  |

**200**: Pool was switched successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/mining/throttle`

Update throttle settings. Auth: **required**. Tag: mining.

**Request body** (`application/json`, ThrottleSettings)

| Field | Type | Req | Description |
|---|---|---|---|
| `percent` | integer (int32) | yes |  |

**200**: Throttle settings updated successfully (`application/json`, SaveConfigResult)

| Field | Type | Req | Description |
|---|---|---|---|
| `reboot_required` | boolean | yes | Miner restart required to apply |
| `restart_required` | boolean | yes | Miner restart required to apply config |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/model`

Get miner model info. Auth: **none**. Tag: other.

**200**: Miner model Info (`application/json`, MinerModelInfo)

| Field | Type | Req | Description |
|---|---|---|---|
| `algorithm` | enum: `sha256d`, `scrypt` | yes |  |
| `chain` | object | yes |  |
| `chain.chips_per_chain` | integer | yes |  |
| `chain.chips_per_domain` | integer (int32) | yes |  |
| `chain.num_chains` | integer | yes |  |
| `chain.topology` | object | yes |  |
| `chain.topology.chips` | array of array of integer (int32) | yes |  |
| `chain.topology.num_cols` | integer (int32) | yes |  |
| `chain.topology.num_rows` | integer (int32) | yes |  |
| `cooling` | object | yes |  |
| `cooling.fan_min_count` | object (nullable) |  |  |
| `cooling.fan_min_count.default` | integer (int32) | yes |  |
| `cooling.fan_min_count.max` | integer (int32) | yes |  |
| `cooling.fan_min_count.min` | integer (int32) | yes |  |
| `cooling.max_target_temp` | integer (int32) | yes |  |
| `cooling.min_fan_pwm` | integer (int32) | yes |  |
| `cooling.min_target_temp` | integer (int32) | yes |  |
| `full_name` | string | yes | Pretty miner name |
| `hr_measure` | enum: `GH/s`, `MH/s` | yes | Hashrate measure unit |
| `install_type` | enum: `sd`, `nand` | yes | Install type code sd\|nand |
| `model` | string | yes | Miner model code |
| `overclock` | object | yes |  |
| `overclock.default_freq` | integer (int32) | yes |  |
| `overclock.default_voltage` | integer (int32) | yes |  |
| `overclock.max_freq` | integer (int32) | yes |  |
| `overclock.max_power_limit` | integer (int32) | yes |  |
| `overclock.max_voltage` | integer (int32) | yes |  |
| `overclock.max_voltage_stock_psu` | integer (int32) | yes |  |
| `overclock.min_freq` | integer (int32) | yes |  |
| `overclock.min_voltage` | integer (int32) | yes |  |
| `overclock.power_metering` | boolean | yes |  |
| `overclock.warn_freq` | integer (int32) | yes |  |
| `platform` | enum: `aml`, `bb`, `cv`, `stm`, `xil` | yes |  |
| `serial` | string | yes |  |
| `series` | enum: `l7`, `l9`, `x19`, `x21` | yes |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "full_name": "Antminer S21 Pro",
  "model": "s21pro",
  "algorithm": "sha256d",
  "series": "x21",
  "platform": "aml",
  "install_type": "nand",
  "hr_measure": "GH/s",
  "serial": "PIEMFKUBDJHJG00KG",
  "chain": {
    "chips_per_chain": 65,
    "chips_per_domain": 5,
    "num_chains": 3,
    "topology": {
      "chips": [
        [
          0,
          1,
          2,
          "\u2026 2 more"
        ],
        [
          9,
          8,
          7,
          "\u2026 2 more"
        ],
        [
          10,
          11,
          12,
          "\u2026 2 more"
        ],
        "\u2026 10 more"
      ],
      "num_cols": 5,
      "num_rows": 13
    }
  },
  "cooling": {
    "min_fan_pwm": 10,
    "min_target_temp": 20,
    "max_target_temp": 90,
    "fan_min_count": {
      "min": 1,
      "max": 4,
      "default": 4
    }
  },
  "overclock": {
    "max_voltage": 1530,
    "min_voltage": 1170,
    "default_voltage": 1380,
    "max_freq": 1000,
    "min_freq": 50,
    "default_freq": 595,
    "warn_freq": 600,
    "max_voltage_stock_psu": 1530,
    "power_metering": true,
    "max_power_limit": 4410
  }
}
```

</details>

### GET `/notes`

Read all notes. Auth: **none**. Tag: notes.

**200**: Notes read successfully (`application/json`)

Type: `object`

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/notes`

Add note. Auth: **required**. Tag: notes.

**Request body** (`application/json`, NoteKeyValue)

| Field | Type | Req | Description |
|---|---|---|---|
| `value` | string | yes |  |
| `key` | string | yes |  |

**200**: Note add successfully

**401**: Unauthorized

**409**: Conflict (`application/json`, ErrDescr)

**500**: Internal Server Error (`application/json`, ErrDescr)

**507**: Insufficient Storage (`application/json`, ErrDescr)

### GET `/notes/{note}`

Get one note json. Auth: **none**. Tag: notes.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `note` | path | string | yes | Note key |

**200**: Notes read successfully (`application/json`, NoteValue)

| Field | Type | Req | Description |
|---|---|---|---|
| `value` | string | yes |  |

**404**: Not found (`application/json`, ErrDescr)

**500**: Internal Server Error (`application/json`, ErrDescr)

### PUT `/notes/{note}`

Update notes. Auth: **required**. Tag: notes.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `note` | path | string | yes | Note key |

**Request body** (`application/json`, NoteValue)

| Field | Type | Req | Description |
|---|---|---|---|
| `value` | string | yes |  |

**200**: Notes add successfully

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### DELETE `/notes/{note}`

Delete note. Auth: **required**. Tag: notes.

**Parameters**

| Name | In | Type | Req | Description |
|---|---|---|---|---|
| `note` | path | string | yes | Note key |

**200**: Note delete successfully

**401**: Unauthorized

**404**: Not found (`application/json`, ErrDescr)

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/perf-summary`

Summary. Auth: **none**. Tag: other.

**200**: Chips read successfully (`application/json`, PerfSummary)

| Field | Type | Req | Description |
|---|---|---|---|
| `current_preset` | object (nullable) |  |  |
| `current_preset.name` | string | yes | Preset id name |
| `current_preset.pretty` | string | yes | Preset human-readable name |
| `current_preset.status` | enum: `untuned`, `tuned` | yes | Preset status. `tuned` means that preset tuned successfully |
| `current_preset.globals` | object (nullable) |  |  |
| `current_preset.globals.freq` | integer (nullable) (int32) |  |  |
| `current_preset.globals.volt` | integer (nullable) (int32) |  |  |
| `preset_switcher` | object | yes | PresetSwitcher settings |
| `preset_switcher.autochange_top_preset` | boolean (nullable) |  |  |
| `preset_switcher.check_time` | integer (nullable) (int32) |  |  |
| `preset_switcher.decrease_temp` | integer (nullable) (int32) |  |  |
| `preset_switcher.enabled` | boolean (nullable) |  |  |
| `preset_switcher.ignore_fan_speed` | boolean (nullable) |  |  |
| `preset_switcher.min_preset` | string (nullable) |  |  |
| `preset_switcher.rise_temp` | integer (nullable) (int32) |  |  |
| `preset_switcher.top_preset` | string (nullable) |  | Profile name. Max profile that preset_switcher can switch |

**500**: Internal Server Error (`application/json`, ErrDescr)

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "current_preset": {
    "name": "2500",
    "pretty": "2500 watt ~ 176 TH",
    "status": "untuned"
  },
  "preset_switcher": {
    "enabled": false,
    "top_preset": "4690",
    "decrease_temp": 77,
    "rise_temp": 70,
    "check_time": 300,
    "autochange_top_preset": false,
    "ignore_fan_speed": false,
    "min_preset": "2440"
  }
}
```

</details>

### POST `/rescan-hardware`

Rescan hardware. Auth: **required**. Tag: other.

**200**: Rescan hardware

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/settings`

Get all miner settings. Auth: **required**. Tag: settings.

**200**: Config read successfully (`application/json`, ViewConfig)

| Field | Type | Req | Description |
|---|---|---|---|
| `miner` | object | yes |  |
| `miner.cooling` | object (nullable) |  |  |
| `miner.cooling.fan_max_duty` | integer (nullable) (int32) |  |  |
| `miner.cooling.fan_min_count` | integer (nullable) (int32) |  |  |
| `miner.cooling.fan_min_duty` | integer (nullable) (int32) |  |  |
| `miner.cooling.min_startup_water_temp` | integer (nullable) (int32) |  |  |
| `miner.cooling.mode` | object (nullable) |  |  |
| `miner.misc` | object (nullable) |  |  |
| `miner.misc.allow_disabling_chains_without_pics` | boolean (nullable) |  | Allow disabling boards without PICs |
| `miner.misc.auto_chip_throttling` | boolean (nullable) |  | Automatically adjusts chip frequencies based on temperatures |
| `miner.misc.automatic_pause_on_boot` | boolean (nullable) |  | The miner automatically switches to pause mode after boot |
| `miner.misc.bitmain_disable_volt_comp` | boolean (nullable) |  | Disable voltage compensation feature |
| `miner.misc.disable_chain_break_protection` | boolean (nullable) |  |  |
| `miner.misc.disable_restart_unbalanced` | boolean (nullable) |  |  |
| `miner.misc.disable_volt_checks` | boolean (nullable) |  |  |
| `miner.misc.downscale_preset_on_failure` | boolean (nullable) |  | Automatic preset reduction in case of miner overheating or board break error |
| `miner.misc.ignore_broken_sensors` | boolean (nullable) |  |  |
| `miner.misc.ignore_chip_sensors` | boolean (nullable) |  |  |
| `miner.misc.keep_hashing_when_offline` | boolean (nullable) |  |  |
| `miner.misc.max_restart_attempts` | integer (nullable) (int32) |  |  |
| `miner.misc.max_startup_delay_time` | integer (nullable) (int32) |  | Maximum delay time before mining startup |
| `miner.misc.min_operational_chains` | integer (nullable) (int32) |  |  |
| `miner.misc.min_startup_delay_time` | integer (nullable) (int32) |  |  |
| `miner.misc.power_limit` | integer (nullable) (int32) |  |  |
| `miner.misc.power_limit_enabled` | boolean (nullable) |  |  |
| `miner.misc.quick_start` | boolean (nullable) |  |  |
| `miner.misc.quiet_mode` | boolean (nullable) |  |  |
| `miner.misc.restart_hashrate` | integer (nullable) (int32) |  | Percent, `0` to disable |
| `miner.misc.restart_temp` | integer (nullable) (int32) |  |  |
| `miner.misc.restore_miner_state_on_reboot` | boolean (nullable) |  | Automatically starts mining after a reboot or power outage, even if mining was previously paused |
| `miner.misc.retune_on_chain_break` | boolean (nullable) |  | Auto retune on board break |
| `miner.misc.tuner_bad_chip_hr_threshold` | integer (nullable) (int32) |  | Autotuning: hashrate threshold below which the chips are marked as bad ones |
| `miner.overclock` | object (nullable) |  |  |
| `miner.overclock.chains` | array (nullable) |  |  |
| `miner.overclock.chains[].chips` | array (nullable) |  | An array of per chip `freq` settings values. `0` (zero) value means that value used from `board` settings |
| `miner.overclock.chains[].disabled` | boolean (nullable) |  | Board `disabled` settings value |
| `miner.overclock.chains[].freq` | integer (nullable) (int32) |  | Board `freq` settings values. `0` (zero) value means that value used from `globals` settings |
| `miner.overclock.globals` | object (nullable) |  |  |
| `miner.overclock.globals.freq` | integer (nullable) (int32) |  |  |
| `miner.overclock.globals.volt` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset` | string (nullable) |  | Profile name |
| `miner.overclock.preset_switcher` | object (nullable) |  |  |
| `miner.overclock.preset_switcher.autochange_top_preset` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.check_time` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.decrease_temp` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.enabled` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.ignore_fan_speed` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.min_preset` | string (nullable) |  |  |
| `miner.overclock.preset_switcher.rise_temp` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.top_preset` | string (nullable) |  | Profile name. Max profile that preset_switcher can switch |
| `miner.pools` | array (nullable) |  |  |
| `network` | object | yes |  |
| `network.dhcp` | boolean | yes |  |
| `network.dnsservers` | array of string | yes |  |
| `network.gateway` | string | yes |  |
| `network.hostname` | string | yes |  |
| `network.ipaddress` | string | yes |  |
| `network.netmask` | string | yes |  |
| `password` | object (nullable) |  |  |
| `password.current` | string | yes |  |
| `password.pw` | string | yes |  |
| `regional` | object | yes |  |
| `regional.timezone` | object | yes |  |
| `regional.timezone.current` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` | yes | Current timezone name (code) |
| `ui` | object | yes |  |
| `ui.consts` | object (nullable) |  |  |
| `ui.consts.cooling` | object | yes |  |
| `ui.consts.cooling.fan_min_count` | object (nullable) |  |  |
| `ui.consts.cooling.fan_min_count.default` | integer (int32) | yes |  |
| `ui.consts.cooling.fan_min_count.max` | integer (int32) | yes |  |
| `ui.consts.cooling.fan_min_count.min` | integer (int32) | yes |  |
| `ui.consts.cooling.max_target_temp` | integer (int32) | yes |  |
| `ui.consts.cooling.min_fan_pwm` | integer (int32) | yes |  |
| `ui.consts.cooling.min_target_temp` | integer (int32) | yes |  |
| `ui.consts.overclock` | object | yes |  |
| `ui.consts.overclock.default_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.default_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.max_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.max_power_limit` | integer (int32) | yes |  |
| `ui.consts.overclock.max_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.max_voltage_stock_psu` | integer (int32) | yes |  |
| `ui.consts.overclock.min_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.min_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.power_metering` | boolean | yes |  |
| `ui.consts.overclock.warn_freq` | integer (int32) | yes |  |
| `ui.consts.timezones` | array of array of any | yes | Available timezones list. A purpose for this field is to display timezones list in UI. Makes sense for GET queries only and shall ignore for UPDATE queries. |
| `ui.dark_side_pane` | boolean (nullable) |  |  |
| `ui.disable_animation` | boolean (nullable) |  |  |
| `ui.locale` | enum: `ru`, `en`, `fa`, `ua`, `zh`, `pt`, `ka` (nullable) |  |  |
| `ui.theme` | enum: `light`, `dark`, `auto` (nullable) |  |  |
| `ui.timezone` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` (nullable) |  |  |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/settings`

Save miner settings. Auth: **required**. Tag: settings.

**Request body** (`application/json`, InputConfig)

| Field | Type | Req | Description |
|---|---|---|---|
| `miner` | object (nullable) |  |  |
| `miner.cooling` | object (nullable) |  |  |
| `miner.cooling.fan_max_duty` | integer (nullable) (int32) |  |  |
| `miner.cooling.fan_min_count` | integer (nullable) (int32) |  |  |
| `miner.cooling.fan_min_duty` | integer (nullable) (int32) |  |  |
| `miner.cooling.min_startup_water_temp` | integer (nullable) (int32) |  |  |
| `miner.cooling.mode` | object (nullable) |  |  |
| `miner.misc` | object (nullable) |  |  |
| `miner.misc.allow_disabling_chains_without_pics` | boolean (nullable) |  | Allow disabling boards without PICs |
| `miner.misc.auto_chip_throttling` | boolean (nullable) |  | Automatically adjusts chip frequencies based on temperatures |
| `miner.misc.automatic_pause_on_boot` | boolean (nullable) |  | The miner automatically switches to pause mode after boot |
| `miner.misc.bitmain_disable_volt_comp` | boolean (nullable) |  | Disable voltage compensation feature |
| `miner.misc.disable_chain_break_protection` | boolean (nullable) |  |  |
| `miner.misc.disable_restart_unbalanced` | boolean (nullable) |  |  |
| `miner.misc.disable_volt_checks` | boolean (nullable) |  |  |
| `miner.misc.downscale_preset_on_failure` | boolean (nullable) |  | Automatic preset reduction in case of miner overheating or board break error |
| `miner.misc.ignore_broken_sensors` | boolean (nullable) |  |  |
| `miner.misc.ignore_chip_sensors` | boolean (nullable) |  |  |
| `miner.misc.keep_hashing_when_offline` | boolean (nullable) |  |  |
| `miner.misc.max_restart_attempts` | integer (nullable) (int32) |  |  |
| `miner.misc.max_startup_delay_time` | integer (nullable) (int32) |  | Maximum delay time before mining startup |
| `miner.misc.min_operational_chains` | integer (nullable) (int32) |  |  |
| `miner.misc.min_startup_delay_time` | integer (nullable) (int32) |  |  |
| `miner.misc.power_limit` | integer (nullable) (int32) |  |  |
| `miner.misc.power_limit_enabled` | boolean (nullable) |  |  |
| `miner.misc.quick_start` | boolean (nullable) |  |  |
| `miner.misc.quiet_mode` | boolean (nullable) |  |  |
| `miner.misc.restart_hashrate` | integer (nullable) (int32) |  | Percent, `0` to disable |
| `miner.misc.restart_temp` | integer (nullable) (int32) |  |  |
| `miner.misc.restore_miner_state_on_reboot` | boolean (nullable) |  | Automatically starts mining after a reboot or power outage, even if mining was previously paused |
| `miner.misc.retune_on_chain_break` | boolean (nullable) |  | Auto retune on board break |
| `miner.misc.tuner_bad_chip_hr_threshold` | integer (nullable) (int32) |  | Autotuning: hashrate threshold below which the chips are marked as bad ones |
| `miner.overclock` | object (nullable) |  |  |
| `miner.overclock.chains` | array (nullable) |  |  |
| `miner.overclock.chains[].chips` | array (nullable) |  | An array of per chip `freq` settings values. `0` (zero) value means that value used from `board` settings |
| `miner.overclock.chains[].disabled` | boolean (nullable) |  | Board `disabled` settings value |
| `miner.overclock.chains[].freq` | integer (nullable) (int32) |  | Board `freq` settings values. `0` (zero) value means that value used from `globals` settings |
| `miner.overclock.globals` | object (nullable) |  |  |
| `miner.overclock.globals.freq` | integer (nullable) (int32) |  |  |
| `miner.overclock.globals.volt` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset` | string (nullable) |  | Profile name |
| `miner.overclock.preset_switcher` | object (nullable) |  |  |
| `miner.overclock.preset_switcher.autochange_top_preset` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.check_time` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.decrease_temp` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.enabled` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.ignore_fan_speed` | boolean (nullable) |  |  |
| `miner.overclock.preset_switcher.min_preset` | string (nullable) |  |  |
| `miner.overclock.preset_switcher.rise_temp` | integer (nullable) (int32) |  |  |
| `miner.overclock.preset_switcher.top_preset` | string (nullable) |  | Profile name. Max profile that preset_switcher can switch |
| `miner.pools` | array (nullable) |  |  |
| `network` | object (nullable) |  |  |
| `network.dhcp` | boolean | yes |  |
| `network.dnsservers` | array of string | yes |  |
| `network.gateway` | string | yes |  |
| `network.hostname` | string | yes |  |
| `network.ipaddress` | string | yes |  |
| `network.netmask` | string | yes |  |
| `network.enable_network_check` | boolean |  |  |
| `password` | object (nullable) |  |  |
| `password.current` | string | yes |  |
| `password.pw` | string | yes |  |
| `regional` | object (nullable) |  |  |
| `regional.timezone` | object | yes |  |
| `regional.timezone.current` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` | yes | Current timezone name (code) |
| `ui` | object (nullable) |  |  |
| `ui.consts` | object (nullable) |  |  |
| `ui.consts.cooling` | object | yes |  |
| `ui.consts.cooling.fan_min_count` | object (nullable) |  |  |
| `ui.consts.cooling.fan_min_count.default` | integer (int32) | yes |  |
| `ui.consts.cooling.fan_min_count.max` | integer (int32) | yes |  |
| `ui.consts.cooling.fan_min_count.min` | integer (int32) | yes |  |
| `ui.consts.cooling.max_target_temp` | integer (int32) | yes |  |
| `ui.consts.cooling.min_fan_pwm` | integer (int32) | yes |  |
| `ui.consts.cooling.min_target_temp` | integer (int32) | yes |  |
| `ui.consts.overclock` | object | yes |  |
| `ui.consts.overclock.default_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.default_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.max_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.max_power_limit` | integer (int32) | yes |  |
| `ui.consts.overclock.max_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.max_voltage_stock_psu` | integer (int32) | yes |  |
| `ui.consts.overclock.min_freq` | integer (int32) | yes |  |
| `ui.consts.overclock.min_voltage` | integer (int32) | yes |  |
| `ui.consts.overclock.power_metering` | boolean | yes |  |
| `ui.consts.overclock.warn_freq` | integer (int32) | yes |  |
| `ui.consts.timezones` | array of array of any | yes | Available timezones list. A purpose for this field is to display timezones list in UI. Makes sense for GET queries only and shall ignore for UPDATE queries. |
| `ui.dark_side_pane` | boolean (nullable) |  |  |
| `ui.disable_animation` | boolean (nullable) |  |  |
| `ui.locale` | enum: `ru`, `en`, `fa`, `ua`, `zh`, `pt`, `ka` (nullable) |  |  |
| `ui.theme` | enum: `light`, `dark`, `auto` (nullable) |  |  |
| `ui.timezone` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` (nullable) |  |  |

**200**: Config saved successfully (`application/json`, SaveConfigResult)

| Field | Type | Req | Description |
|---|---|---|---|
| `reboot_required` | boolean | yes | Miner restart required to apply |
| `restart_required` | boolean | yes | Miner restart required to apply config |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/settings/backup`

Settings backup. Auth: **required**. Tag: settings.

**200**: Backup binary (`application/octet-stream`)

Type: `array of integer (int32)`

**401**: Unauthorized

### POST `/settings/factory-reset`

Settings factory reset. Auth: **required**. Tag: settings.

**200**: Settings factory reset done successfully. System will reboot after (`application/json`, RebootAfter)

| Field | Type | Req | Description |
|---|---|---|---|
| `after` | integer (int64) | yes | Number of seconds after the system will reboot By default, is 3 seconds |

**401**: Unauthorized

**500**: Internal Server Error (`application/json`, ErrDescr)

### POST `/settings/restore`

Settings restore. Auth: **required**. Tag: settings.

**Request body** (`multipart/form-data`, SchemaSettingsRestore)

| Field | Type | Req | Description |
|---|---|---|---|
| `file` | string (binary) | yes |  |

**200**: Firmware restored successfully. System will reboot after (`application/json`, RebootAfter)

| Field | Type | Req | Description |
|---|---|---|---|
| `after` | integer (int64) | yes | Number of seconds after the system will reboot By default, is 3 seconds |

**401**: Unauthorized

**403**: Miner have warranty. Cancel warranty first

**500**: Internal Server Error (`application/json`, ErrDescr)

### GET `/status`

Get status. Auth: **none**. Tag: other.

**200**: success (`application/json`, StatusPane)

| Field | Type | Req | Description |
|---|---|---|---|
| `description` | string (nullable) |  | Optional. Description if status is failure |
| `failure_code` | integer (nullable) (int32) |  |  |
| `miner_state` | enum: `mining`, `initializing`, `starting`, `auto-tuning`, `restarting`, `shutting-down`, `stopped`, `failure` | yes |  |
| `miner_state_time` | integer (int64) | yes | Time spent in the current state. For now implemented for `mining` state only. |
| `throttled` | integer (int32) | yes |  |
| `reboot_required` | boolean | yes | Miner restart required to apply |
| `restart_required` | boolean | yes | Miner restart required to apply config |
| `find_miner` | boolean | yes | Flag to switch locate_miner function on target devices. Optional, default `false` |
| `unlock_timeout` | integer (nullable) (int64) |  |  |
| `unlocked` | boolean | yes | Show screen-lock status (checks that  any of auth methods satisfies) |
| `warranty` | enum: `active`, `inactive`, `expired`, `cancelled`, `not_provided` |  |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "miner_state": "auto-tuning",
  "throttled": 100,
  "miner_state_time": 3902,
  "find_miner": false,
  "restart_required": false,
  "reboot_required": false,
  "unlocked": false
}
```

</details>

### GET `/summary`

Summary. Auth: **optional**. Tag: other.

**200**: Summary read successfully (`application/json`, Summary)

| Field | Type | Req | Description |
|---|---|---|---|
| `miner` | object (nullable) |  |  |
| `miner.average_hashrate` | number (float) | yes | Deprecated. Same as hr_average but measure is MG/s. |
| `miner.best_share` | integer (int64) | yes |  |
| `miner.chains` | array of object | yes |  |
| `miner.chains[].chip_statuses` | object | yes |  |
| `miner.chains[].chip_statuses.grey` | integer (int32) | yes |  |
| `miner.chains[].chip_statuses.orange` | integer (int32) | yes |  |
| `miner.chains[].chip_statuses.red` | integer (int32) | yes |  |
| `miner.chains[].chip_temp` | object | yes |  |
| `miner.chains[].chip_temp.max` | integer (int32) | yes |  |
| `miner.chains[].chip_temp.min` | integer (int32) | yes |  |
| `miner.chains[].frequency` | number (float) | yes |  |
| `miner.chains[].hashrate_ideal` | number (float) | yes |  |
| `miner.chains[].hashrate_percentage` | number (float) | yes |  |
| `miner.chains[].hashrate_rt` | number (float) | yes |  |
| `miner.chains[].hr_error` | number (float) | yes |  |
| `miner.chains[].hw_errors` | integer (int32) | yes |  |
| `miner.chains[].id` | integer | yes |  |
| `miner.chains[].inlet_water_temp` | integer (nullable) (int32) |  |  |
| `miner.chains[].outlet_water_temp` | integer (nullable) (int32) |  |  |
| `miner.chains[].pcb_temp` | object | yes |  |
| `miner.chains[].pcb_temp.max` | integer (int32) | yes |  |
| `miner.chains[].pcb_temp.min` | integer (int32) | yes |  |
| `miner.chains[].power_consumption` | integer (int32) | yes |  |
| `miner.chains[].status` | object | yes |  |
| `miner.chains[].status.description` | string (nullable) |  |  |
| `miner.chains[].status.state` | enum: `initializing`, `mining`, `stopped`, `failure`, `disconnected`, `disabled`, `unknown` | yes |  |
| `miner.chains[].voltage` | integer (int32) | yes |  |
| `miner.chip_temp` | object | yes |  |
| `miner.chip_temp.max` | integer (int32) | yes |  |
| `miner.chip_temp.min` | integer (int32) | yes |  |
| `miner.cooling` | object | yes |  |
| `miner.cooling.fan_duty` | integer (int32) | yes |  |
| `miner.cooling.fan_num` | integer | yes |  |
| `miner.cooling.fans` | array of object | yes |  |
| `miner.cooling.fans[].id` | integer | yes |  |
| `miner.cooling.fans[].max_rpm` | integer (int32) | yes |  |
| `miner.cooling.fans[].rpm` | integer (int32) | yes |  |
| `miner.cooling.fans[].status` | enum: `ok`, `lost` | yes |  |
| `miner.cooling.settings` | object | yes |  |
| `miner.cooling.settings.mode` | object | yes |  |
| `miner.devfee` | number (float) | yes |  |
| `miner.devfee_percent` | number (float) | yes |  |
| `miner.found_blocks` | integer (int32) | yes |  |
| `miner.hr_average` | number (float) | yes |  |
| `miner.hr_error` | number (float) | yes | Errors rate |
| `miner.hr_nominal` | number (float) | yes |  |
| `miner.hr_realtime` | number (float) | yes |  |
| `miner.hr_stock` | number (float) | yes |  |
| `miner.hw_errors` | integer (int32) | yes |  |
| `miner.hw_errors_percent` | number (float) | yes |  |
| `miner.instant_hashrate` | number (float) | yes | Deprecated. Same as hr_realtime but measure is MG/s. |
| `miner.miner_status` | object | yes |  |
| `miner.miner_status.description` | string (nullable) |  | Optional. Description if status is failure |
| `miner.miner_status.failure_code` | integer (nullable) (int32) |  |  |
| `miner.miner_status.miner_state` | enum: `mining`, `initializing`, `starting`, `auto-tuning`, `restarting`, `shutting-down`, `stopped`, `failure` | yes |  |
| `miner.miner_status.miner_state_time` | integer (int64) | yes | Time spent in the current state. For now implemented for `mining` state only. |
| `miner.miner_status.throttled` | integer (int32) | yes |  |
| `miner.miner_type` | string | yes |  |
| `miner.pcb_temp` | object | yes |  |
| `miner.pcb_temp.max` | integer (int32) | yes |  |
| `miner.pcb_temp.min` | integer (int32) | yes |  |
| `miner.pools` | array of object | yes |  |
| `miner.pools[].accepted` | integer (int32) | yes |  |
| `miner.pools[].diff` | string | yes |  |
| `miner.pools[].diffa` | number (double) | yes |  |
| `miner.pools[].id` | integer (int32) | yes |  |
| `miner.pools[].ls_diff` | number (float) | yes |  |
| `miner.pools[].ls_time` | string | yes |  |
| `miner.pools[].ping` | integer (int32) | yes |  |
| `miner.pools[].pool_type` | enum: `UserPool`, `DevFee`, `Refund` | yes |  |
| `miner.pools[].rejected` | integer (int32) | yes |  |
| `miner.pools[].stale` | integer (int32) | yes |  |
| `miner.pools[].status` | enum: `offline`, `working`, `disabled`, `active`, `rejecting`, `unknown` | yes |  |
| `miner.pools[].url` | string | yes |  |
| `miner.pools[].use_tls` | boolean | yes |  |
| `miner.pools[].user` | string | yes |  |
| `miner.power_consumption` | integer (int32) | yes |  |
| `miner.power_efficiency` | number (float) | yes |  |
| `miner.power_usage` | integer (int32) | yes | Deprecated. Same as power_efficiency |
| `miner.psu` | object (nullable) |  |  |
| `miner.psu.psu_power_metering` | boolean (nullable) |  |  |
| `miner.psu.temps` | object (nullable) |  |  |
| `miner.psu.temps.llc1_temp` | integer (nullable) (int32) |  |  |
| `miner.psu.temps.llc2_temp` | integer (nullable) (int32) |  |  |
| `miner.psu.temps.pfc_temp` | integer (nullable) (int32) |  |  |
| `miner.restart_count` | integer | yes |  |

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "miner": {
    "miner_status": {
      "miner_state": "auto-tuning",
      "throttled": 100,
      "miner_state_time": 3902
    },
    "miner_type": "Antminer S21 Pro (Vnish 1.3.5)",
    "hr_stock": 79029.0,
    "average_hashrate": 151.9825,
    "instant_hashrate": 154.52917,
    "hr_realtime": 154529.17,
    "hr_nominal": 168487.69,
    "hr_average": 151982.5,
    "pcb_temp": {
      "min": 31,
      "max": 51
    },
    "chip_temp": {
      "min": 46,
      "max": 66
    },
    "power_consumption": 2092,
    "power_usage": 2092,
    "power_efficiency": 13.764743,
    "hw_errors_percent": 0.008,
    "hr_error": 13.525,
    "hw_errors": 63,
    "devfee_percent": 2.339,
    "devfee": 3614.8574,
    "pools": [
      {
        "id": 0,
        "url": "btc.global.luxor.tech:700",
        "pool_type": "UserPool",
        "user": "*****",
        "use_tls": false,
        "status": "active",
        "diff": "1.05M",
        "accepted": 269,
        "rejected": 1,
        "stale": 0,
        "ls_diff": 1048576.0,
        "ls_time": "0:00:20",
        "diffa": 131072000.0,
        "ping": 14
      },
      {
        "id": 1,
        "url": "DevFee",
        "pool_type": "DevFee",
        "user": "*****",
        "use_tls": true,
        "status": "working",
        "diff": "32.8K",
        "accepted": 98,
        "rejected": 0,
        "stale": 0,
        "ls_diff": 32768.0,
        "ls_time": "0:06:46",
        "diffa": 2473984.0,
        "ping": 0
      }
    ],
    "cooling": {
      "fan_num": 4,
      "fans": [
        {
          "id": 0,
          "rpm": 2820,
          "status": "ok",
          "max_rpm": 7000
        },
        {
          "id": 1,
          "rpm": 2790,
          "status": "ok",
          "max_rpm": 7000
        },
        {
          "id": 2,
          "rpm": 2760,
          "status": "ok",
          "max_rpm": 7000
        },
        "\u2026 1 more"
      ],
      "settings": {
        "mode": {
          "name": "auto",
          "param": 65
        }
      },
      "fan_duty": 35
    },
    "chains": [
      {
        "id": 1,
        "frequency": 423.6,
        "voltage": 13064,
        "power_consumption": 697,
        "hashrate_ideal": 56169.36,
        "hashrate_rt": 50811.684,
        "hashrate_percentage": 90.13,
        "hr_error": 0.0,
        "hw_errors": 49,
        "pcb_temp": {
          "min": 32,
          "max": 51
        },
        "chip_temp": {
          "min": 47,
          "max": 66
        },
        "chip_statuses": {
          "red": 0,
          "orange": 1,
          "grey": 64
        },
        "status": {
          "state": "mining"
        }
      },
      {
        "id": 2,
        "frequency": 452.07693,
        "voltage": 13064,
        "power_consumption": 744,
        "hashrate_ideal": 59945.4,
        "hashrate_rt": 54838.832,
        "hashrate_percentage": 90.9,
        "hr_error": 9.76,
        "hw_errors": 13,
        "pcb_temp": {
          "min": 34,
          "max": 50
        },
        "chip_temp": {
          "min": 49,
          "max": 65
        },
        "chip_statuses": {
          "red": 1,
          "orange": 0,
          "grey": 64
        },
        "status": {
          "state": "mining"
        }
      },
      {
        "id": 3,
        "frequency": 394.96924,
        "voltage": 13064,
        "power_consumption": 650,
        "hashrate_ideal": 52372.92,
        "hashrate_rt": 48878.656,
        "hashrate_percentage": 89.47,
        "hr_error": 3.76,
        "hw_errors": 1,
        "pcb_temp": {
          "min": 31,
          "max": 46
        },
        "chip_temp": {
          "min": 46,
          "max": 61
        },
        "chip_statuses": {
          "red": 1,
          "orange": 0,
          "grey": 64
        },
        "status": {
          "state": "mining"
        }
      }
    ],
    "found_blocks": 0,
    "best_share": 90227891,
    "psu": {
      "temps": {
        "pfc_temp": 25,
        "llc1_temp": 28,
        "llc2_temp": 28
      },
      "psu_power_metering": true
    },
    "restart_count": 0
  }
}
```

</details>

### POST `/system/reboot`

System reboot. Auth: **required**. Tag: system.

**200**: System reboot after (`application/json`, RebootAfter)

| Field | Type | Req | Description |
|---|---|---|---|
| `after` | integer (int64) | yes | Number of seconds after the system will reboot By default, is 3 seconds |

**401**: Unauthorized

### GET `/ui`

UI. Auth: **none**. Tag: other.

**200**: Ui read successfully (`application/json`, UiSettings)

| Field | Type | Req | Description |
|---|---|---|---|
| `consts` | object (nullable) |  |  |
| `consts.cooling` | object | yes |  |
| `consts.cooling.fan_min_count` | object (nullable) |  |  |
| `consts.cooling.fan_min_count.default` | integer (int32) | yes |  |
| `consts.cooling.fan_min_count.max` | integer (int32) | yes |  |
| `consts.cooling.fan_min_count.min` | integer (int32) | yes |  |
| `consts.cooling.max_target_temp` | integer (int32) | yes |  |
| `consts.cooling.min_fan_pwm` | integer (int32) | yes |  |
| `consts.cooling.min_target_temp` | integer (int32) | yes |  |
| `consts.overclock` | object | yes |  |
| `consts.overclock.default_freq` | integer (int32) | yes |  |
| `consts.overclock.default_voltage` | integer (int32) | yes |  |
| `consts.overclock.max_freq` | integer (int32) | yes |  |
| `consts.overclock.max_power_limit` | integer (int32) | yes |  |
| `consts.overclock.max_voltage` | integer (int32) | yes |  |
| `consts.overclock.max_voltage_stock_psu` | integer (int32) | yes |  |
| `consts.overclock.min_freq` | integer (int32) | yes |  |
| `consts.overclock.min_voltage` | integer (int32) | yes |  |
| `consts.overclock.power_metering` | boolean | yes |  |
| `consts.overclock.warn_freq` | integer (int32) | yes |  |
| `consts.timezones` | array of array of any | yes | Available timezones list. A purpose for this field is to display timezones list in UI. Makes sense for GET queries only and shall ignore for UPDATE queries. |
| `dark_side_pane` | boolean (nullable) |  |  |
| `disable_animation` | boolean (nullable) |  |  |
| `locale` | enum: `ru`, `en`, `fa`, `ua`, `zh`, `pt`, `ka` (nullable) |  |  |
| `theme` | enum: `light`, `dark`, `auto` (nullable) |  |  |
| `timezone` | enum: `GMT+1`, `GMT+2`, `GMT+3`, `GMT+4`, `GMT+5`, `GMT+6`, `GMT+7`, `GMT+8`, `GMT+9`, `GMT+10`, `GMT+11`, `GMT+12`, `GMT`, `GMT-1`, `GMT-2`, `GMT-3`, `GMT-4`, `GMT-5`, `GMT-6`, `GMT-7`, `GMT-8`, `GMT-9`, `GMT-10`, `GMT-11` (nullable) |  |  |

**500**: Internal Server Error (`application/json`, ErrDescr)

<details><summary>Sample response (S21 Pro; long lists trimmed)</summary>

```json
{
  "theme": "auto",
  "dark_side_pane": false,
  "disable_animation": false,
  "locale": "en",
  "timezone": "GMT",
  "consts": {
    "cooling": {
      "min_fan_pwm": 10,
      "min_target_temp": 20,
      "max_target_temp": 90,
      "fan_min_count": {
        "min": 1,
        "max": 4,
        "default": 4
      }
    },
    "overclock": {
      "max_voltage": 1530,
      "min_voltage": 1170,
      "default_voltage": 1380,
      "max_freq": 1000,
      "min_freq": 50,
      "default_freq": 595,
      "warn_freq": 600,
      "max_voltage_stock_psu": 1530,
      "power_metering": true,
      "max_power_limit": 4410
    },
    "timezones": [
      [
        "GMT-11",
        "GMT-11"
      ],
      [
        "GMT-10",
        "GMT-10"
      ],
      [
        "GMT-9",
        "GMT-09"
      ],
      "\u2026 21 more"
    ]
  }
}
```

</details>

### POST `/unlock`

Auth Check. Auth: **none**. Tag: auth.

**Request body** (`application/json`, UnlockScreenBody)

| Field | Type | Req | Description |
|---|---|---|---|
| `pw` | string | yes | Target device(s) password |

**200**: Authorized (`application/json`, UnlockSuccess)

| Field | Type | Req | Description |
|---|---|---|---|
| `token` | string | yes |  |

**403**: Wrong password (`application/json`, AuthCheck)

**429**: Too many requests (`application/json`, AuthCheck)

**500**: Internal Server Error (`application/json`, ErrDescr)
