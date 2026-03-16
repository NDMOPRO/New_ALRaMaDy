import { createHash } from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const root = process.cwd();
const outputBase = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const proofRoot = path.join(
  outputBase,
  `remote-dashboard-gateway-proof-${new Date().toISOString().replace(/[:.]/g, "-")}`
);
const artifactsDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const auditDir = path.join(proofRoot, "audit");
const lineageDir = path.join(proofRoot, "lineage");
const browserDir = path.join(proofRoot, "browser");
[proofRoot, artifactsDir, evidenceDir, auditDir, lineageDir, browserDir].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true })
);

const now = () => new Date().toISOString();
const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const latestSampleRoot = (prefix) => {
  const matches = fs
    .readdirSync(outputBase, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(outputBase, entry.name))
    .sort((left, right) => fs.statSync(left).mtimeMs - fs.statSync(right).mtimeMs);
  if (matches.length === 0) {
    throw new Error(`No sample output found for prefix ${prefix}`);
  }
  return matches.at(-1);
};

const passRoot = latestSampleRoot("sample-run-dashboard-en-ar-pass-");
const degradedRoot = latestSampleRoot("sample-run-dashboard-en-ar-degraded-");
const passClosure = JSON.parse(fs.readFileSync(path.join(passRoot, "artifacts", "dashboard-artifact-closure.json"), "utf8"));
const degradedClosure = JSON.parse(
  fs.readFileSync(path.join(degradedRoot, "artifacts", "dashboard-artifact-closure.json"), "utf8")
);
const passMetadata = JSON.parse(fs.readFileSync(path.join(passRoot, "artifacts", "native-adapter-metadata.json"), "utf8"));
const degradedMetadata = JSON.parse(fs.readFileSync(path.join(degradedRoot, "artifacts", "native-adapter-metadata.json"), "utf8"));

const publications = {
  pass: {
    tenant_ref: "tenant-localization-pass",
    publication_id: passClosure.lifecycle.publication_id,
    manifest_path: passClosure.manifest_path ?? passMetadata.transport.manifest_path,
    publish_state_path: passClosure.publish_state_path ?? passMetadata.transport.publish_state_path,
    embed_payload_path: passClosure.embed_payload_path ?? passMetadata.transport.embed_payload_path,
    embed_html_path: path.join(passRoot, "published", "dashboard-bundle", "embed.html"),
    status: "pass"
  },
  degraded: {
    tenant_ref: "tenant-localization-degraded",
    publication_id: degradedClosure.lifecycle.publication_id,
    manifest_path: degradedClosure.manifest_path ?? degradedMetadata.transport.manifest_path,
    publish_state_path: degradedClosure.publish_state_path ?? degradedMetadata.transport.publish_state_path,
    embed_payload_path: degradedClosure.embed_payload_path ?? degradedMetadata.transport.embed_payload_path,
    embed_html_path: path.join(degradedRoot, "published", "dashboard-bundle", "embed.html"),
    status: "degraded"
  }
};

const secret = sha(`${now()}|rasid-remote-gateway`);
let remoteBaseUrl = null;

const sign = (tenantRef, publicationId, asset) => sha(`${tenantRef}|${publicationId}|${asset}|${secret}`);

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    if (parts.length !== 5 || parts[0] !== "gateway" || parts[2] !== "publications") {
      response.writeHead(404);
      response.end("not_found");
      return;
    }
    const tenantRef = parts[1];
    const publicationId = parts[3];
    const asset = parts[4];
    const publication = Object.values(publications).find(
      (entry) => entry.tenant_ref === tenantRef && entry.publication_id === publicationId
    );
    if (!publication) {
      response.writeHead(404);
      response.end("publication_not_found");
      return;
    }
    if (requestUrl.searchParams.get("sig") !== sign(tenantRef, publicationId, asset)) {
      response.writeHead(403);
      response.end("invalid_signature");
      return;
    }
    const assetPath =
      asset === "manifest"
        ? publication.manifest_path
        : asset === "state"
          ? publication.publish_state_path
          : asset === "embed-payload"
            ? publication.embed_payload_path
            : asset === "embed"
              ? publication.embed_html_path
              : null;
    if (!assetPath || !fs.existsSync(assetPath)) {
      response.writeHead(404);
      response.end("asset_not_found");
      return;
    }
    if (asset === "manifest") {
      const manifest = JSON.parse(fs.readFileSync(assetPath, "utf8"));
      const base = `${remoteBaseUrl}/gateway/${tenantRef}/publications/${publicationId}`;
      manifest.remote_gateway = {
        tenant_ref: tenantRef,
        publication_id: publicationId,
        signed_manifest_url: `${base}/manifest?sig=${sign(tenantRef, publicationId, "manifest")}`,
        signed_publish_state_url: `${base}/state?sig=${sign(tenantRef, publicationId, "state")}`,
        signed_embed_payload_url: `${base}/embed-payload?sig=${sign(tenantRef, publicationId, "embed-payload")}`,
        signed_embed_html_url: `${base}/embed?sig=${sign(tenantRef, publicationId, "embed")}`
      };
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(`${JSON.stringify(manifest, null, 2)}\n`);
      return;
    }
    response.writeHead(200, {
      "content-type": asset === "embed" ? "text/html; charset=utf-8" : "application/json; charset=utf-8"
    });
    response.end(fs.readFileSync(assetPath));
  } catch (error) {
    response.writeHead(500);
    response.end(error instanceof Error ? error.message : String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const localAddress = server.address();
const localPort = typeof localAddress === "object" && localAddress ? localAddress.port : 0;

const tunnel = spawn(
  "ssh",
  ["-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=30", "-R", `80:127.0.0.1:${localPort}`, "nokey@localhost.run"],
  { cwd: root }
);

const tunnelLogPath = path.join(artifactsDir, "localhostrun.log");
const tunnelErrPath = path.join(artifactsDir, "localhostrun.err.log");
const tunnelLog = fs.createWriteStream(tunnelLogPath, { flags: "a" });
const tunnelErr = fs.createWriteStream(tunnelErrPath, { flags: "a" });
tunnel.stdout.pipe(tunnelLog);
tunnel.stderr.pipe(tunnelErr);

remoteBaseUrl = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for localhost.run URL")), 25000);
  const onData = (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9.-]+/i);
    if (match) {
      clearTimeout(timeout);
      tunnel.stdout.off("data", onData);
      resolve(match[0]);
    }
  };
  tunnel.stdout.on("data", onData);
});

const fetchJson = async (url) => {
  const response = await fetch(url);
  return { status: response.status, body: await response.text() };
};

const remoteRefs = Object.fromEntries(
  Object.entries(publications).map(([key, publication]) => {
    const base = `${remoteBaseUrl}/gateway/${publication.tenant_ref}/publications/${publication.publication_id}`;
    return [
      key,
      {
        manifest: `${base}/manifest?sig=${sign(publication.tenant_ref, publication.publication_id, "manifest")}`,
        state: `${base}/state?sig=${sign(publication.tenant_ref, publication.publication_id, "state")}`,
        payload: `${base}/embed-payload?sig=${sign(publication.tenant_ref, publication.publication_id, "embed-payload")}`,
        embed: `${base}/embed?sig=${sign(publication.tenant_ref, publication.publication_id, "embed")}`
      }
    ];
  })
);

const passManifest = await fetchJson(remoteRefs.pass.manifest);
const passState = await fetchJson(remoteRefs.pass.state);
const degradedManifest = await fetchJson(remoteRefs.degraded.manifest);
const degradedState = await fetchJson(remoteRefs.degraded.state);
const tenantIsolationProbe = await fetch(`${remoteBaseUrl}/gateway/${publications.pass.tenant_ref}/publications/${publications.pass.publication_id}/manifest?sig=bad`);

let screenshotRefs = {};
if (fs.existsSync(chromePath)) {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(remoteRefs.pass.embed, { waitUntil: "networkidle" });
  const passScreenshot = path.join(browserDir, "remote-pass-embed.png");
  await page.screenshot({ path: passScreenshot, fullPage: true });
  await page.goto(remoteRefs.degraded.embed, { waitUntil: "networkidle" });
  const degradedScreenshot = path.join(browserDir, "remote-degraded-embed.png");
  await page.screenshot({ path: degradedScreenshot, fullPage: true });
  await browser.close();
  screenshotRefs = { pass_screenshot: passScreenshot, degraded_screenshot: degradedScreenshot };
}

const proof = {
  generated_at: now(),
  remote_host: remoteBaseUrl,
  local_gateway_port: localPort,
  pass: {
    tenant_ref: publications.pass.tenant_ref,
    publication_id: publications.pass.publication_id,
    manifest_url: remoteRefs.pass.manifest,
    state_url: remoteRefs.pass.state,
    embed_url: remoteRefs.pass.embed,
    manifest_status: passManifest.status,
    state_status: passState.status
  },
  degraded: {
    tenant_ref: publications.degraded.tenant_ref,
    publication_id: publications.degraded.publication_id,
    manifest_url: remoteRefs.degraded.manifest,
    state_url: remoteRefs.degraded.state,
    embed_url: remoteRefs.degraded.embed,
    manifest_status: degradedManifest.status,
    state_status: degradedState.status
  },
  tenant_isolation: {
    invalid_signature_status: tenantIsolationProbe.status,
    invalid_signature_expected: 403
  },
  screenshots: screenshotRefs
};

const proofPath = writeJson(path.join(artifactsDir, "remote-dashboard-gateway-proof.json"), proof);
const evidencePath = writeJson(path.join(evidenceDir, "evidence.json"), {
  remote_host: remoteBaseUrl,
  pass_manifest_excerpt: passManifest.body.slice(0, 4000),
  degraded_manifest_excerpt: degradedManifest.body.slice(0, 4000),
  pass_state_excerpt: passState.body.slice(0, 2000),
  degraded_state_excerpt: degradedState.body.slice(0, 2000),
  screenshots: screenshotRefs
});
const auditPath = writeJson(path.join(auditDir, "audit.json"), [
  {
    event_id: "audit-remote-dashboard-pass",
    timestamp: now(),
    action: "remote_publish_gateway_validate",
    object_ref: publications.pass.publication_id,
    tenant_ref: publications.pass.tenant_ref,
    remote_url: remoteRefs.pass.embed
  },
  {
    event_id: "audit-remote-dashboard-degraded",
    timestamp: now(),
    action: "remote_publish_gateway_validate",
    object_ref: publications.degraded.publication_id,
    tenant_ref: publications.degraded.tenant_ref,
    remote_url: remoteRefs.degraded.embed
  }
]);
const lineagePath = writeJson(path.join(lineageDir, "lineage.json"), [
  {
    edge_id: "lineage-remote-pass",
    from_ref: publications.pass.publication_id,
    to_ref: remoteRefs.pass.embed,
    transform_ref: "arabic_localization_lct.remote_gateway_publish"
  },
  {
    edge_id: "lineage-remote-degraded",
    from_ref: publications.degraded.publication_id,
    to_ref: remoteRefs.degraded.embed,
    transform_ref: "arabic_localization_lct.remote_gateway_publish"
  }
]);

console.log(`localization-remote-gateway-proof=${proofPath}`);
console.log(`localization-remote-gateway-evidence=${evidencePath}`);
console.log(`localization-remote-gateway-audit=${auditPath}`);
console.log(`localization-remote-gateway-lineage=${lineagePath}`);

tunnel.kill();
server.close();
