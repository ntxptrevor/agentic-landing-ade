// Smartcar REST + OAuth helper for the myGMC integration MCP server.
//
// This module talks to the Smartcar API directly over HTTPS (no SDK
// dependency) and manages the OAuth 2.0 access/refresh token lifecycle by
// persisting tokens to a small JSON file on disk. All vehicle calls flow
// through `request()`, which transparently refreshes an expired access token
// before issuing the call.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ---------------------------------------------------------------------------
// Configuration (sourced from the environment)
// ---------------------------------------------------------------------------

const API_BASE = process.env.SMARTCAR_API_BASE || "https://api.smartcar.com/v2.0";
const CONNECT_BASE = "https://connect.smartcar.com/oauth/authorize";
const TOKEN_URL = "https://auth.smartcar.com/oauth/token";

// Smartcar Connect mode: "live" for real vehicles, "test"/"simulated" for the
// Smartcar simulator. Defaults to live so a real 2026 Sierra EV can connect.
const MODE = process.env.SMARTCAR_MODE || "live";

// Unit system for distance-bearing responses (battery range, odometer).
// A US-market Sierra EV owner generally wants imperial.
const UNIT_SYSTEM = (process.env.SMARTCAR_UNIT_SYSTEM || "imperial").toLowerCase();

// Default OAuth scopes appropriate for an EV pickup. control_security and
// control_charge enable commands (lock/unlock, start/stop charging).
export const DEFAULT_SCOPES = [
  "read_vehicle_info",
  "read_vin",
  "read_location",
  "read_odometer",
  "read_battery",
  "read_charge",
  "control_charge",
  "read_security",
  "control_security",
  "read_tires",
];

const TOKEN_PATH =
  process.env.SMARTCAR_TOKEN_PATH ||
  path.join(os.homedir(), ".mygmc-smartcar", "tokens.json");

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

function requireCredentials() {
  const clientId = process.env.SMARTCAR_CLIENT_ID;
  const clientSecret = process.env.SMARTCAR_CLIENT_SECRET;
  const redirectUri = process.env.SMARTCAR_REDIRECT_URI;
  const missing = [];
  if (!clientId) missing.push("SMARTCAR_CLIENT_ID");
  if (!clientSecret) missing.push("SMARTCAR_CLIENT_SECRET");
  if (!redirectUri) missing.push("SMARTCAR_REDIRECT_URI");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set these from your Smartcar dashboard application credentials."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuthHeader(clientId, clientSecret) {
  const raw = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${raw}`;
}

// ---------------------------------------------------------------------------
// Token persistence
// ---------------------------------------------------------------------------

export function loadTokens() {
  try {
    const raw = fs.readFileSync(TOKEN_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function clearTokens() {
  try {
    fs.unlinkSync(TOKEN_PATH);
    return true;
  } catch {
    return false;
  }
}

function tokensFromResponse(json) {
  const now = Date.now();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    // expires_in is seconds; store an absolute expiry with a small safety margin.
    expires_at: now + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
    obtained_at: now,
  };
}

// ---------------------------------------------------------------------------
// OAuth 2.0 flow
// ---------------------------------------------------------------------------

export function buildConnectUrl({ scopes, state, forcePrompt } = {}) {
  const { clientId, redirectUri } = requireCredentials();
  const scopeList = scopes && scopes.length ? scopes : DEFAULT_SCOPES;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopeList.join(" "),
    mode: MODE,
  });
  if (state) params.set("state", state);
  if (forcePrompt) params.set("approval_prompt", "force");
  return `${CONNECT_BASE}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = requireCredentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const tokens = tokensFromResponse(await res.json());
  saveTokens(tokens);
  return tokens;
}

async function refreshTokens(refreshToken) {
  const { clientId, clientSecret } = requireCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${text}. ` +
        "You may need to re-authorize with get_connect_url / exchange_code."
    );
  }
  const tokens = tokensFromResponse(await res.json());
  saveTokens(tokens);
  return tokens;
}

async function getValidAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token) {
    throw new Error(
      "Not authorized yet. Run get_connect_url, complete the Smartcar Connect " +
        "flow in your browser, then pass the returned code to exchange_code."
    );
  }
  // Refresh if the access token expires within the next 60 seconds.
  if (Date.now() > tokens.expires_at - 60_000) {
    if (!tokens.refresh_token) {
      throw new Error("Access token expired and no refresh token is stored. Re-authorize.");
    }
    const refreshed = await refreshTokens(tokens.refresh_token);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Authenticated API requests
// ---------------------------------------------------------------------------

export async function request(method, endpoint, { body } = {}) {
  const accessToken = await getValidAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "SC-Unit-System": UNIT_SYSTEM,
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, init);
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail = parsed?.description || parsed?.message || text || res.statusText;
    const err = new Error(`Smartcar API ${method} ${endpoint} failed (${res.status}): ${detail}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Vehicle helpers
// ---------------------------------------------------------------------------

// List the IDs of all vehicles authorized for the connected account.
export async function listVehicleIds() {
  const data = await request("GET", "/vehicles");
  return data.vehicles || [];
}

// Resolve which vehicle to act on: an explicit id, the SMARTCAR_VEHICLE_ID
// env override, or the first authorized vehicle.
export async function resolveVehicleId(vehicleId) {
  if (vehicleId) return vehicleId;
  if (process.env.SMARTCAR_VEHICLE_ID) return process.env.SMARTCAR_VEHICLE_ID;
  const ids = await listVehicleIds();
  if (!ids.length) {
    throw new Error("No vehicles are connected to this Smartcar account.");
  }
  return ids[0];
}

export const config = { API_BASE, MODE, UNIT_SYSTEM, TOKEN_PATH };
