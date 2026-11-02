#!/usr/bin/env node
// Verifies the AMO API credentials and access to this add-on, without uploading anything.
// Env: AMO_JWT_ISSUER, AMO_JWT_SECRET
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const { AMO_JWT_ISSUER, AMO_JWT_SECRET } = process.env;
if (!AMO_JWT_ISSUER || !AMO_JWT_SECRET) {
  console.error("Missing AMO_JWT_ISSUER / AMO_JWT_SECRET");
  process.exit(1);
}
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
const guid = manifest.browser_specific_settings.gecko.id;

const b64url = (x) => Buffer.from(x).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const payload = b64url(JSON.stringify({ iss: AMO_JWT_ISSUER, jti: randomUUID(), iat: now, exp: now + 60 }));
const sig = createHmac("sha256", AMO_JWT_SECRET).update(`${header}.${payload}`).digest("base64url");

const res = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(guid)}/`, {
  headers: { Authorization: `JWT ${header}.${payload}.${sig}` },
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`AMO check failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  process.exit(1);
}
console.log(`AMO access OK: ${body.slug} (current version ${body.current_version?.version}, status ${body.status})`);
