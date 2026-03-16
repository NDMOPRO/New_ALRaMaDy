import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright-core";

const host = "127.0.0.1";
const allocatePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate dashboard live performance port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });
const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const runId = `live-performance-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputRoot = path.join(process.cwd(), "packages", "dashboard-engine", "output", runId);
const runtimePerfRoot = path.join(process.cwd(), ".runtime", "dashboard-web", "performance");
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-live-performance-${runRef}`;
const workspaceId = `workspace-dashboard-live-performance-${runRef}`;
const projectId = `project-dashboard-live-performance-${runRef}`;

const ensureDir = (directoryPath) => fs.mkdirSync(directoryPath, { recursive: true });
const writeJson = (relativePath, payload) => {
  const filePath = path.join(outputRoot, relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // keep retrying
    }
    await wait(250);
  }
  throw new Error("dashboard web server did not start");
};

const server = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_PORT: String(port),
    RASID_DASHBOARD_TRANSPORT_PORT: String(transportPort)
  },
  stdio: "ignore"
});

const buildRows = () => {
  const statuses = ["Open", "Closed", "Delayed", "Escalated"];
  const regions = ["Riyadh", "Jeddah", "Dammam", "Madinah", "Qassim"];
  const departments = ["Sales", "Support", "Finance", "Ops"];
  return Array.from({ length: 480 }, (_, index) => {
    const status = statuses[index % statuses.length];
    const region = regions[index % regions.length];
    const department = departments[index % departments.length];
    return {
      date: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
      department,
      status,
      region,
      revenue: 80 + (index % 17) * 9,
      margin: 12 + (index % 9) * 3,
      count: 3 + (index % 11),
      latitude: 24.7136 + (index % 5) * 0.05,
      longitude: 46.6753 + (index % 5) * 0.07
    };
  });
};

const createWebSocketClient = ({ token }) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setNoDelay(true);
    const key = randomBytes(16).toString("base64");
    let handshakeBuffer = Buffer.alloc(0);
    let frameBuffer = Buffer.alloc(0);
    let settled = false;
    const stats = {
      connected: false,
      message_count: 0,
      bytes_received: 0,
      last_payload: null
    };

    const client = {
      socket,
      stats,
      close: () =>
        new Promise((resolveClose) => {
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            resolveClose();
          };
          socket.once("close", finish);
          socket.once("end", finish);
          socket.end();
          setTimeout(() => {
            socket.destroy();
            finish();
          }, 150);
        })
    };

    const processFrames = () => {
      while (frameBuffer.length >= 2) {
        const opcode = frameBuffer[0] & 0x0f;
        let payloadLength = frameBuffer[1] & 0x7f;
        let offset = 2;
        if (payloadLength === 126) {
          if (frameBuffer.length < 4) return;
          payloadLength = frameBuffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLength === 127) {
          if (frameBuffer.length < 10) return;
          payloadLength = Number(frameBuffer.readBigUInt64BE(2));
          offset = 10;
        }
        if (frameBuffer.length < offset + payloadLength) return;
        const payload = frameBuffer.slice(offset, offset + payloadLength);
        frameBuffer = frameBuffer.slice(offset + payloadLength);
        if (opcode === 0x1) {
          stats.message_count += 1;
          stats.bytes_received += payload.length;
          try {
            stats.last_payload = JSON.parse(payload.toString("utf8"));
          } catch {
            stats.last_payload = payload.toString("utf8");
          }
        }
      }
    };

    socket.on("connect", () => {
      socket.write(
        [
          "GET /ws/dashboards HTTP/1.1",
          `Host: ${host}:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          `Cookie: rasid_auth=${encodeURIComponent(token)}; rasid_tenant=${encodeURIComponent(tenantRef)}; rasid_workspace=${encodeURIComponent(workspaceId)}; rasid_project=${encodeURIComponent(projectId)}`,
          "\r\n"
        ].join("\r\n")
      );
    });

    socket.on("data", (chunk) => {
      if (!stats.connected) {
        handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
        const terminator = handshakeBuffer.indexOf("\r\n\r\n");
        if (terminator === -1) return;
        const header = handshakeBuffer.slice(0, terminator).toString("utf8");
        if (!header.includes("101 Switching Protocols")) {
          reject(new Error(`websocket handshake failed: ${header.split("\r\n")[0]}`));
          socket.destroy();
          return;
        }
        stats.connected = true;
        frameBuffer = handshakeBuffer.slice(terminator + 4);
        handshakeBuffer = Buffer.alloc(0);
        if (!settled) {
          settled = true;
          resolve(client);
        }
      } else {
        frameBuffer = Buffer.concat([frameBuffer, chunk]);
      }
      processFrames();
    });

    socket.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    socket.on("close", () => {
      if (!settled) {
        settled = true;
        reject(new Error("websocket closed before handshake"));
      }
    });
  });

const totalMessages = (clients) => clients.reduce((sum, client) => sum + client.stats.message_count, 0);
const totalBytes = (clients) => clients.reduce((sum, client) => sum + client.stats.bytes_received, 0);

const terminateChild = async (childProcess) => {
  if (!childProcess || childProcess.exitCode !== null) return;
  childProcess.kill();
  await Promise.race([
    new Promise((resolve) => childProcess.once("exit", resolve)),
    wait(1000)
  ]);
  if (childProcess.exitCode === null) {
    childProcess.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => childProcess.once("exit", resolve)),
      wait(1000)
    ]);
  }
};

const waitForMessageTarget = async (clients, expectedMessages, timeoutMs = 10000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (clients.every((client) => client.stats.message_count >= expectedMessages)) return true;
    await wait(50);
  }
  return false;
};

let browser;
let context;
let streamBrowser;
let streamContext;
let websocketClients = [];

try {
  ensureDir(outputRoot);
  ensureDir(path.join(outputRoot, "artifacts"));
  ensureDir(path.join(outputRoot, "evidence"));
  ensureDir(path.join(outputRoot, "audit"));
  ensureDir(path.join(outputRoot, "lineage"));
  ensureDir(path.join(outputRoot, "browser"));
  ensureDir(path.join(outputRoot, "api"));

  await waitForServer();

  const loginResponse = await fetch(`${baseUrl}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin",
      password: "1500",
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      project_id: projectId
    })
  });
  const loginPayload = await loginResponse.json();
  const token = loginPayload.data.accessToken;

  const api = async (endpoint, method = "GET", body = undefined) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-ref": tenantRef,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    writeJson(path.join("api", `${endpoint.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root"}-${method.toLowerCase()}.json`), payload);
    return payload;
  };

  const dataset = await api("/api/v1/data/register", "POST", {
    title: "Live Performance Dataset",
    rows: buildRows()
  });
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  const created = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: "Live Performance Dashboard",
    description: "Dedicated performance proof dashboard",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, filter, map, compare, growth, and anomaly coverage."
  });
  const dashboardId = created.snapshot.dashboard.dashboard_id;

  for (const [index, widgetType] of ["map", "scatter_3d", "heatmap", "compare_chart", "top_bottom", "growth_indicator", "anomaly_alert"].entries()) {
    await api("/api/v1/dashboards/add-widget", "POST", {
      dashboard_id: dashboardId,
      widget_type: widgetType,
      x: (index % 3) * 4,
      y: 6 + Math.floor(index / 3) * 3
    });
  }

  await api("/api/v1/dashboards/perf/cache/prime", "POST", { dashboard_id: dashboardId });
  const loadModel = await api(`/api/v1/dashboards/perf/load-model?dashboard_id=${encodeURIComponent(dashboardId)}`, "GET");

  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  await context.addCookies([
    { name: "rasid_auth", value: encodeURIComponent(token), domain: host, path: "/" },
    { name: "rasid_tenant", value: encodeURIComponent(tenantRef), domain: host, path: "/" },
    { name: "rasid_workspace", value: encodeURIComponent(workspaceId), domain: host, path: "/" },
    { name: "rasid_project", value: encodeURIComponent(projectId), domain: host, path: "/" }
  ]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__rasidDashboardPerf && window.__rasidDashboardPerf.load_ms !== null));
  const uiLoadProof = await page.evaluate(() => ({
    perf: window.__rasidDashboardPerf,
    status: document.getElementById("status")?.textContent ?? null,
    perfPanel: document.getElementById("perf-panel")?.textContent ?? null
  }));
  await page.screenshot({ path: path.join(outputRoot, "browser", "dashboard-load-proof.png"), fullPage: true });
  await context.close();
  context = undefined;
  await browser.close();
  browser = undefined;

  const fallbackCache = await api("/api/v1/dashboards/perf/cache/fallback", "POST", { dashboard_id: dashboardId });
  const concurrencyProof = await api("/api/v1/dashboards/perf/concurrency", "POST", {
    dashboard_id: dashboardId,
    concurrent_users: 50000
  });

  const websocketClientCount = 768;
  websocketClients = await Promise.all(Array.from({ length: websocketClientCount }, () => createWebSocketClient({ token })));
  await wait(300);

  const scaleoutBefore = totalMessages(websocketClients);
  const scaleoutRoute = await api("/api/v1/dashboards/perf/websocket-burst", "POST", {
    dashboard_id: dashboardId,
    scenario: "scaleout",
    message_count: 6,
    payload_size_bytes: 96
  });
  await waitForMessageTarget(websocketClients, 6, 5000);
  const scaleoutAfter = totalMessages(websocketClients);
  const scaleoutReceived = scaleoutAfter - scaleoutBefore;
  const scaleoutExpected = websocketClients.length * 6;

  const pressureBeforeMessages = totalMessages(websocketClients);
  const pressureBeforeBytes = totalBytes(websocketClients);
  const pressureRoute = await api("/api/v1/dashboards/perf/websocket-burst", "POST", {
    dashboard_id: dashboardId,
    scenario: "stream_pressure",
    message_count: 120,
    payload_size_bytes: 1024
  });
  await waitForMessageTarget(websocketClients, 126, 15000);
  const pressureAfterMessages = totalMessages(websocketClients);
  const pressureAfterBytes = totalBytes(websocketClients);
  const pressureReceived = pressureAfterMessages - pressureBeforeMessages;
  const pressureExpected = websocketClients.length * 120;

  streamBrowser = await chromium.launch({ headless: true, executablePath: chromePath });
  streamContext = await streamBrowser.newContext({ viewport: { width: 1600, height: 1100 } });
  await streamContext.addCookies([
    { name: "rasid_auth", value: encodeURIComponent(token), domain: host, path: "/" },
    { name: "rasid_tenant", value: encodeURIComponent(tenantRef), domain: host, path: "/" },
    { name: "rasid_workspace", value: encodeURIComponent(workspaceId), domain: host, path: "/" },
    { name: "rasid_project", value: encodeURIComponent(projectId), domain: host, path: "/" }
  ]);
  const streamPage = await streamContext.newPage();
  await streamPage.goto(`${baseUrl}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`, { waitUntil: "networkidle" });
  await streamPage.waitForFunction(() => Boolean(window.__rasidDashboardPerf && window.__rasidDashboardPerf.load_ms !== null));
  await streamPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-stream-proof.png"), fullPage: true });
  await streamContext.close();
  streamContext = undefined;
  await streamBrowser.close();
  streamBrowser = undefined;

  const runtimeMetrics = await api("/api/v1/dashboards/perf/metrics", "GET");
  const runtimeMetricsPath = path.join(runtimePerfRoot, "metrics.json");

  const loadArtifact = {
    route: "/dashboards?dashboard_id=<id>",
    api_route: "/api/v1/dashboards/state?dashboard_id=<id>",
    dashboard_id: dashboardId,
    load_ms: Number(uiLoadProof.perf.load_ms),
    cache_status: uiLoadProof.perf.last_perf_meta?.cache_status ?? null,
    under_two_seconds: Number(uiLoadProof.perf.load_ms) < 2000,
    screenshot: path.join(outputRoot, "browser", "dashboard-load-proof.png"),
    load_model: loadModel
  };
  const fallbackArtifact = {
    route: "/api/v1/dashboards/perf/cache/fallback",
    dashboard_id: dashboardId,
    cache_status: fallbackCache.perf_meta?.cache_status ?? null,
    fallback_hit: fallbackCache.perf_meta?.cache_status === "fallback_cache",
    cached_at: fallbackCache.perf_meta?.cached_at ?? null
  };
  const concurrencyArtifact = {
    route: "/api/v1/dashboards/perf/concurrency",
    dashboard_id: dashboardId,
    concurrent_users: concurrencyProof.concurrent_users,
    simulation_mode: concurrencyProof.simulation_mode,
    wall_time_ms: concurrencyProof.wall_time_ms,
    per_user_p95_ms: concurrencyProof.per_user_p95_ms,
    load_model: concurrencyProof.load_model
  };
  const websocketScaleoutArtifact = {
    route: "/ws/dashboards + /api/v1/dashboards/perf/websocket-burst",
    dashboard_id: dashboardId,
    connected_clients: websocketClients.length,
    messages_per_client: 6,
    expected_deliveries: scaleoutExpected,
    received_deliveries: scaleoutReceived,
    receive_ratio: Number((scaleoutReceived / scaleoutExpected).toFixed(6)),
    route_summary: scaleoutRoute
  };
  const streamPressureArtifact = {
    route: "/ws/dashboards + /api/v1/dashboards/perf/websocket-burst",
    dashboard_id: dashboardId,
    connected_clients: websocketClients.length,
    messages_per_client: 120,
    expected_deliveries: pressureExpected,
    received_deliveries: pressureReceived,
    receive_ratio: Number((pressureReceived / pressureExpected).toFixed(6)),
    received_bytes_delta: pressureAfterBytes - pressureBeforeBytes,
    route_summary: pressureRoute,
    screenshot: path.join(outputRoot, "browser", "dashboard-stream-proof.png")
  };

  const summary = {
    run_id: runId,
    dashboard_id: dashboardId,
    runtime_perf_root: runtimePerfRoot,
    ui_load_under_two_seconds: loadArtifact.under_two_seconds,
    virtual_concurrent_users_50000: concurrencyArtifact.concurrent_users === 50000,
    websocket_scaleout_clients: websocketScaleoutArtifact.connected_clients,
    fallback_cache_hit: fallbackArtifact.fallback_hit,
    live_stream_pressure_ratio: streamPressureArtifact.receive_ratio
  };

  const evidence = {
    checks: {
      dashboard_load_lt_2s: loadArtifact.under_two_seconds,
      virtual_concurrent_users_50000: concurrencyArtifact.concurrent_users === 50000,
      websocket_scaleout: websocketScaleoutArtifact.receive_ratio >= 0.99,
      fallback_cache: fallbackArtifact.fallback_hit,
      live_stream_pressure: streamPressureArtifact.receive_ratio >= 0.99
    },
    artifacts: {
      load: "artifacts/dashboard-load-proof.json",
      concurrency: "artifacts/concurrent-50k-proof.json",
      websocket_scaleout: "artifacts/websocket-scaleout-proof.json",
      fallback_cache: "artifacts/fallback-cache-proof.json",
      live_stream_pressure: "artifacts/live-stream-pressure-proof.json",
      metrics: "artifacts/runtime-metrics.json"
    }
  };

  if (!Object.values(evidence.checks).every(Boolean)) {
    throw new Error(`dashboard live performance checks failed: ${JSON.stringify(evidence.checks)}`);
  }

  writeJson("artifacts/dashboard-load-proof.json", loadArtifact);
  writeJson("artifacts/concurrent-50k-proof.json", concurrencyArtifact);
  writeJson("artifacts/websocket-scaleout-proof.json", websocketScaleoutArtifact);
  writeJson("artifacts/fallback-cache-proof.json", fallbackArtifact);
  writeJson("artifacts/live-stream-pressure-proof.json", streamPressureArtifact);
  writeJson("artifacts/runtime-metrics.json", runtimeMetrics);
  writeJson("artifacts/summary.json", summary);
  writeJson("evidence/evidence.json", evidence);
  writeJson("audit/audit.json", {
    run_id: runId,
    executed_at: new Date().toISOString(),
    base_url: baseUrl,
    routes: [
      "/dashboards",
      "/api/v1/dashboards/state",
      "/api/v1/dashboards/perf/load-model",
      "/api/v1/dashboards/perf/cache/prime",
      "/api/v1/dashboards/perf/cache/fallback",
      "/api/v1/dashboards/perf/concurrency",
      "/api/v1/dashboards/perf/metrics",
      "/api/v1/dashboards/perf/websocket-burst",
      "/ws/dashboards"
    ],
    runtime_metrics_path: runtimeMetricsPath
  });
  writeJson("lineage/lineage.json", {
    edges: [
      { from: "/dashboards", to: "artifacts/dashboard-load-proof.json", kind: "ui_perf_proof" },
      { from: "/api/v1/dashboards/perf/concurrency", to: "artifacts/concurrent-50k-proof.json", kind: "virtual_concurrency_proof" },
      { from: "/ws/dashboards", to: "artifacts/websocket-scaleout-proof.json", kind: "websocket_scaleout_proof" },
      { from: "/api/v1/dashboards/perf/cache/fallback", to: "artifacts/fallback-cache-proof.json", kind: "fallback_cache_proof" },
      { from: "/ws/dashboards", to: "artifacts/live-stream-pressure-proof.json", kind: "stream_pressure_proof" }
    ]
  });

  await Promise.allSettled(websocketClients.map((client) => client.close()));
  websocketClients = [];
  await Promise.allSettled([context?.close()]);
  context = undefined;
  await Promise.allSettled([browser?.close()]);
  browser = undefined;

  console.log(outputRoot);
} finally {
  await Promise.allSettled(websocketClients.map((client) => client.close()));
  await Promise.allSettled([context?.close(), browser?.close(), streamContext?.close(), streamBrowser?.close()]);
  await terminateChild(server);
}
