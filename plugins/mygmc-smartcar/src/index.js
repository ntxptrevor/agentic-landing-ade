#!/usr/bin/env node
// myGMC Smartcar MCP server.
//
// Exposes the Smartcar API as MCP tools so an assistant can read EV state
// (battery, charge, location, odometer, tire pressure) and send commands
// (lock/unlock, start/stop charging, set charge limit) for a GM/GMC vehicle
// such as a 2026 GMC Sierra EV. Communicates over stdio.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  DEFAULT_SCOPES,
  buildConnectUrl,
  exchangeCode,
  clearTokens,
  loadTokens,
  request,
  listVehicleIds,
  resolveVehicleId,
  config,
} from "./smartcar.js";

const server = new McpServer({
  name: "mygmc-smartcar",
  version: "1.0.0",
});

// Wrap a handler so thrown errors are returned as MCP tool errors with a
// readable message rather than crashing the transport.
function tool(name, description, shape, handler) {
  server.tool(name, description, shape, async (args) => {
    try {
      const result = await handler(args || {});
      const text =
        typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  });
}

const vehicleArg = {
  vehicleId: z
    .string()
    .optional()
    .describe(
      "Smartcar vehicle ID. Omit to use SMARTCAR_VEHICLE_ID or the first connected vehicle."
    ),
};

// --- Authorization ---------------------------------------------------------

tool(
  "get_connect_url",
  "Generate a Smartcar Connect OAuth URL. Open it in a browser, log in to your " +
    "GM/myGMC account, and approve access. Smartcar redirects to your configured " +
    "redirect URI with a ?code= parameter to pass to exchange_code.",
  {
    scopes: z
      .array(z.string())
      .optional()
      .describe(`OAuth scopes. Defaults to: ${DEFAULT_SCOPES.join(", ")}`),
    state: z.string().optional().describe("Opaque state value echoed back on redirect."),
    forcePrompt: z
      .boolean()
      .optional()
      .describe("Force the approval screen even if previously approved."),
  },
  async ({ scopes, state, forcePrompt }) => {
    const url = buildConnectUrl({ scopes, state, forcePrompt });
    return { connectUrl: url, mode: config.MODE };
  }
);

tool(
  "exchange_code",
  "Exchange the authorization code from the Smartcar Connect redirect for access " +
    "and refresh tokens. Tokens are stored locally and refreshed automatically.",
  {
    code: z.string().describe("The ?code= value from the redirect URL."),
  },
  async ({ code }) => {
    const tokens = await exchangeCode(code);
    return {
      authorized: true,
      expiresAt: new Date(tokens.expires_at).toISOString(),
      scope: tokens.scope,
    };
  }
);

tool(
  "auth_status",
  "Report whether the server holds valid Smartcar tokens and where they are stored.",
  {},
  async () => {
    const tokens = loadTokens();
    if (!tokens) {
      return { authorized: false, tokenPath: config.TOKEN_PATH };
    }
    return {
      authorized: true,
      expiresAt: new Date(tokens.expires_at).toISOString(),
      expired: Date.now() > tokens.expires_at,
      scope: tokens.scope,
      tokenPath: config.TOKEN_PATH,
    };
  }
);

tool(
  "disconnect",
  "Delete the stored Smartcar tokens from this machine (local logout).",
  {},
  async () => ({ cleared: clearTokens() })
);

// --- Vehicle discovery & info ----------------------------------------------

tool(
  "list_vehicles",
  "List the IDs of all vehicles connected to the authorized Smartcar account.",
  {},
  async () => ({ vehicles: await listVehicleIds() })
);

tool(
  "vehicle_info",
  "Get a vehicle's make, model, year, and VIN.",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    const [attributes, vin] = await Promise.all([
      request("GET", `/vehicles/${id}`),
      request("GET", `/vehicles/${id}/vin`),
    ]);
    return { id, ...attributes, vin: vin.vin };
  }
);

// --- EV battery & charging --------------------------------------------------

tool(
  "get_battery",
  "Get the EV's battery state of charge (percent remaining) and estimated range.",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/battery`);
  }
);

tool(
  "get_battery_capacity",
  "Get the EV's total usable battery capacity in kWh (Smartcar early-access endpoint).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/battery/capacity`);
  }
);

tool(
  "get_charge_status",
  "Get the EV's charging status: whether it is plugged in and the charge state.",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/charge`);
  }
);

tool(
  "get_charge_limit",
  "Get the EV's configured charge limit (target maximum state of charge).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/charge/limit`);
  }
);

tool(
  "set_charge_limit",
  "Set the EV's charge limit as a fraction between 0.5 and 1.0 (e.g. 0.8 = 80%).",
  {
    ...vehicleArg,
    limit: z
      .number()
      .min(0.5)
      .max(1)
      .describe("Target charge limit as a decimal fraction, e.g. 0.8 for 80%."),
  },
  async ({ vehicleId, limit }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("POST", `/vehicles/${id}/charge/limit`, { body: { limit } });
  }
);

tool(
  "start_charge",
  "Start charging the EV (requires control_charge scope and a plugged-in vehicle).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("POST", `/vehicles/${id}/charge`, { body: { action: "START" } });
  }
);

tool(
  "stop_charge",
  "Stop charging the EV (requires control_charge scope).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("POST", `/vehicles/${id}/charge`, { body: { action: "STOP" } });
  }
);

// --- Location, odometer, tires ---------------------------------------------

tool(
  "get_location",
  "Get the vehicle's last known GPS location (latitude/longitude).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/location`);
  }
);

tool(
  "get_odometer",
  "Get the vehicle's odometer reading (distance in the configured unit system).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/odometer`);
  }
);

tool(
  "get_tire_pressure",
  "Get the vehicle's tire pressure readings for each tire.",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("GET", `/vehicles/${id}/tires/pressure`);
  }
);

// --- Security commands ------------------------------------------------------

tool(
  "lock",
  "Lock all of the vehicle's doors (requires control_security scope).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("POST", `/vehicles/${id}/security`, { body: { action: "LOCK" } });
  }
);

tool(
  "unlock",
  "Unlock all of the vehicle's doors (requires control_security scope).",
  { ...vehicleArg },
  async ({ vehicleId }) => {
    const id = await resolveVehicleId(vehicleId);
    return request("POST", `/vehicles/${id}/security`, { body: { action: "UNLOCK" } });
  }
);

// --- Boot -------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logging; stdout is reserved for the MCP protocol.
  console.error("mygmc-smartcar MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting mygmc-smartcar MCP server:", err);
  process.exit(1);
});
