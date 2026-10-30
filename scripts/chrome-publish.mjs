#!/usr/bin/env node
// Uploads a zip to the Chrome Web Store and submits it for review (CWS API v2, service account).
// Usage: node scripts/chrome-publish.mjs dist/want-not-x.y.z.zip [--check]
// Env: CWS_SERVICE_ACCOUNT_KEY (JSON key), CWS_PUBLISHER_ID, CWS_EXTENSION_ID
import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const zipPath = process.argv[2];
const { CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;
if (!zipPath || !CWS_SERVICE_ACCOUNT_KEY || !CWS_PUBLISHER_ID || !CWS_EXTENSION_ID) {
  console.error("Missing zip path or CWS_SERVICE_ACCOUNT_KEY / CWS_PUBLISHER_ID / CWS_EXTENSION_ID");
  process.exit(1);
}

const API = "https://chromewebstore.googleapis.com";
const item = `publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`;
const b64url = (x) => Buffer.from(x).toString("base64url");

// Service account key -> signed JWT -> OAuth access token
async function accessToken() {
  const key = JSON.parse(CWS_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/chromewebstore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token request failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function call(token, method, url, body, contentType = "application/json") {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": contentType } : {}) },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${url} -> HTTP ${res.status}: ${text}`);
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const token = await accessToken();

if (process.argv.includes("--check")) {
  // Verifies credentials and dashboard access without uploading anything.
  const status = await call(token, "GET", `${API}/v2/${item}:fetchStatus`);
  console.log("Chrome Web Store access OK:", JSON.stringify(status));
  process.exit(0);
}

console.log(`Uploading ${zipPath} …`);
const upload = await call(token, "POST", `${API}/upload/v2/${item}:upload`, await readFile(zipPath), "application/zip");
console.log("Upload:", JSON.stringify(upload));

let state = upload.uploadState;
for (let i = 0; state === "IN_PROGRESS" && i < 20; i++) {
  await sleep(5000);
  const status = await call(token, "GET", `${API}/v2/${item}:fetchStatus`);
  state = status.lastAsyncUploadState ?? state;
  console.log("Upload state:", state);
}
if (state && state !== "SUCCEEDED") throw new Error(`Upload did not succeed (state: ${state})`);

const publish = await call(token, "POST", `${API}/v2/${item}:publish`, "{}");
console.log("Submitted for review:", JSON.stringify(publish));
