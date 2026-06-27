# myGMC Smartcar MCP

An [MCP](https://modelcontextprotocol.io) server that connects an assistant to
your GMC / GM electric vehicle (e.g. a **2026 GMC Sierra EV**) through the
[Smartcar API](https://smartcar.com/docs). It speaks the standard Smartcar OAuth
flow against your myGMC / GM account and exposes EV telemetry and commands as
MCP tools.

> Smartcar is the supported integration path for GM brands. GM shut down its
> own third-party telematics token program, so Smartcar is the practical way to
> reach a 2026 Sierra EV programmatically. Confirm your specific VIN is
> supported in the Smartcar dashboard before relying on commands.

## What it can do

| Capability | Tool(s) | Smartcar scope |
| --- | --- | --- |
| Authorize an account | `get_connect_url`, `exchange_code`, `auth_status`, `disconnect` | — |
| List connected vehicles | `list_vehicles` | — |
| Make / model / year / VIN | `vehicle_info` | `read_vehicle_info`, `read_vin` |
| Battery charge & range | `get_battery` | `read_battery` |
| Battery capacity (kWh) | `get_battery_capacity` | `read_battery` |
| Charging status | `get_charge_status` | `read_charge` |
| Charge limit (get/set) | `get_charge_limit`, `set_charge_limit` | `read_charge` / `control_charge` |
| Start / stop charging | `start_charge`, `stop_charge` | `control_charge` |
| Location | `get_location` | `read_location` |
| Odometer | `get_odometer` | `read_odometer` |
| Tire pressure | `get_tire_pressure` | `read_tires` |
| Lock / unlock doors | `lock`, `unlock` | `control_security` |

## Prerequisites

1. A free [Smartcar developer account](https://dashboard.smartcar.com) and an
   application, which gives you a **Client ID** and **Client Secret**.
2. A **Redirect URI** registered on that application that matches
   `SMARTCAR_REDIRECT_URI` exactly.
3. Node.js 18+.

## Setup

```bash
cd plugins/mygmc-smartcar
npm install
cp .env.example .env   # then fill in your Smartcar credentials
```

Required environment variables (see `.env.example` for the full list):

- `SMARTCAR_CLIENT_ID`
- `SMARTCAR_CLIENT_SECRET`
- `SMARTCAR_REDIRECT_URI`

Optional: `SMARTCAR_MODE` (`live`/`test`/`simulated`, default `live`),
`SMARTCAR_UNIT_SYSTEM` (`imperial`/`metric`, default `imperial`),
`SMARTCAR_VEHICLE_ID`, `SMARTCAR_TOKEN_PATH`, `SMARTCAR_API_BASE`.

## Register with Claude Code

**As a plugin (recommended):** install this marketplace and enable the
`mygmc-smartcar` plugin. The plugin manifest launches the server via
`${CLAUDE_PLUGIN_ROOT}/src/index.js` and reads the `SMARTCAR_*` variables from
your environment, so export them before starting Claude Code.

**Manually**, add it to your MCP config (e.g. `~/.claude.json` or a project
`.mcp.json`):

```json
{
  "mcpServers": {
    "mygmc-smartcar": {
      "command": "node",
      "args": ["/absolute/path/to/plugins/mygmc-smartcar/src/index.js"],
      "env": {
        "SMARTCAR_CLIENT_ID": "...",
        "SMARTCAR_CLIENT_SECRET": "...",
        "SMARTCAR_REDIRECT_URI": "https://example.com/callback",
        "SMARTCAR_MODE": "live",
        "SMARTCAR_UNIT_SYSTEM": "imperial"
      }
    }
  }
}
```

Or with the CLI:

```bash
claude mcp add mygmc-smartcar \
  -e SMARTCAR_CLIENT_ID=... \
  -e SMARTCAR_CLIENT_SECRET=... \
  -e SMARTCAR_REDIRECT_URI=https://example.com/callback \
  -- node /absolute/path/to/plugins/mygmc-smartcar/src/index.js
```

## First-run authorization

You authorize once; tokens are cached at `SMARTCAR_TOKEN_PATH` (default
`~/.mygmc-smartcar/tokens.json`, mode `0600`) and refreshed automatically.

### Option A — one command (recommended)

Set `SMARTCAR_REDIRECT_URI` to a loopback URL (e.g.
`http://localhost:4466/callback`) and register that exact URI on your Smartcar
application, then run:

```bash
npm run connect
```

This prints a Connect URL, captures the redirect automatically, exchanges the
code, and saves your tokens — no copy/paste.

### Option B — via the MCP tools

1. Call **`get_connect_url`**. Open the returned URL in a browser.
2. Log in to your **GM / myGMC** account and approve access to your Sierra EV.
3. Smartcar redirects to your redirect URI with a `?code=...` parameter.
4. Call **`exchange_code`** with that `code`.

After that, just ask: *"What's my Sierra's battery level?"*, *"Start charging"*,
*"Lock the truck"*, *"Where is it parked?"*

## How it works

- `src/smartcar.js` — OAuth (authorize URL, code exchange, automatic refresh),
  on-disk token storage, and a thin authenticated `request()` wrapper over the
  Smartcar REST API (`https://api.smartcar.com/v2.0`).
- `src/index.js` — the MCP server (stdio) that maps each capability to a tool.

No Smartcar SDK dependency — calls are made directly with `fetch`, so the only
runtime dependencies are the MCP SDK and `zod`.

## Notes & limitations

- Tokens are stored unencrypted on the local machine; protect the host
  accordingly (the file is written with `0600` permissions).
- Command support (lock/unlock, start/stop charge, charge limit) depends on what
  Smartcar enables for your specific vehicle and on the scopes you approved.
- `get_battery_capacity` uses Smartcar's early-access capacity endpoint and may
  not be available for every vehicle.
