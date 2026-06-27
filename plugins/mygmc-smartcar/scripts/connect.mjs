#!/usr/bin/env node
// One-shot OAuth helper for first-run setup.
//
// Spins up a tiny local web server on the host/port of your
// SMARTCAR_REDIRECT_URI, prints the Smartcar Connect URL to open in a browser,
// then automatically captures the ?code= from the redirect, exchanges it for
// tokens, and saves them — so you never have to copy/paste the code by hand.
//
// Usage:
//   SMARTCAR_REDIRECT_URI=http://localhost:4466/callback \
//   SMARTCAR_CLIENT_ID=... SMARTCAR_CLIENT_SECRET=... \
//   npm run connect
//
// The redirect URI must be registered on your Smartcar application and must be
// a loopback http URL (localhost / 127.0.0.1) for this helper to receive it.

import http from "node:http";
import { buildConnectUrl, exchangeCode, config } from "../src/smartcar.js";

const redirect = process.env.SMARTCAR_REDIRECT_URI;
if (!redirect) {
  console.error("SMARTCAR_REDIRECT_URI is required.");
  process.exit(1);
}

let url;
try {
  url = new URL(redirect);
} catch {
  console.error(`SMARTCAR_REDIRECT_URI is not a valid URL: ${redirect}`);
  process.exit(1);
}

const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (!isLoopback) {
  console.error(
    `This helper can only auto-capture loopback redirects (got host "${url.hostname}").\n` +
      "Either set SMARTCAR_REDIRECT_URI to e.g. http://localhost:4466/callback and\n" +
      "register that URI in your Smartcar dashboard, or use the get_connect_url /\n" +
      "exchange_code MCP tools to authorize manually."
  );
  process.exit(1);
}

const port = Number(url.port) || 80;
const callbackPath = url.pathname || "/";

const connectUrl = buildConnectUrl({ forcePrompt: true });

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  if (reqUrl.pathname !== callbackPath) {
    res.writeHead(404).end("Not found");
    return;
  }

  const error = reqUrl.searchParams.get("error");
  const code = reqUrl.searchParams.get("code");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
    console.error(`\nAuthorization failed: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400).end("Missing code");
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h1>Connected ✅</h1><p>Your vehicle is now linked. You can close this tab and return to the assistant.</p>"
    );
    console.error(
      `\nAuthorized. Tokens saved to ${config.TOKEN_PATH}\n` +
        `Expires at ${new Date(tokens.expires_at).toISOString()}\n` +
        `Scopes: ${tokens.scope || "(default)"}`
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Token exchange failed</h1><pre>${err.message}</pre>`);
    console.error(`\nToken exchange failed: ${err.message}`);
    server.close();
    process.exit(1);
  }
  server.close();
  process.exit(0);
});

server.listen(port, () => {
  console.error(`Listening for the Smartcar redirect on ${redirect}\n`);
  console.error("Open this URL in your browser to connect your vehicle:\n");
  console.error(connectUrl + "\n");
});
