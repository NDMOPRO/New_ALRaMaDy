/**
 * Connection Test — Verifies live connectivity to the ALRaMaDy backend engines
 * 
 * Tests:
 * 1. Platform reachability (health check for all engines)
 * 2. Authentication (login with credentials)
 * 3. API access (governance state endpoint)
 * 4. WebSocket URL resolution
 * 
 * Run: npx tsx server/connectionTest.ts
 */
import "dotenv/config";
import {
  platformHealthCheck,
  platformLogin,
  getPlatformWebSocketUrl,
  getEngineUrls,
} from "./platformConnector";

const PLATFORM_URL = process.env.RASID_PLATFORM_URL || "http://localhost:4400";
const PLATFORM_EMAIL = process.env.RASID_PLATFORM_EMAIL || "mruhaily";

async function runConnectionTests() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   RASID ↔ ALRaMaDy Connection Test                  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Platform URL: ${PLATFORM_URL}`);
  console.log(`Username:     ${PLATFORM_EMAIL}`);
  console.log();

  const results: Array<{ test: string; status: "pass" | "fail" | "skip"; detail: string }> = [];

  // Test 1: Health Check (all engines)
  console.log("━━━ Test 1: Platform Reachability ━━━");
  try {
    const health = await platformHealthCheck();
    if (health.connected) {
      console.log("  ✅ Platform is reachable");
      for (const [name, info] of Object.entries(health.engines)) {
        const icon = info.connected ? "✅" : "❌";
        console.log(`    ${icon} ${name}: ${info.url}${info.error ? ` (${info.error})` : ""}`);
      }
      results.push({ test: "Health Check", status: "pass", detail: `Engines connected` });
    } else {
      console.log("  ❌ No engines reachable");
      results.push({ test: "Health Check", status: "fail", detail: "No engines reachable" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Health check failed: ${msg}`);
    results.push({ test: "Health Check", status: "fail", detail: msg });
  }
  console.log();

  // Test 2: Authentication
  console.log("━━━ Test 2: Authentication ━━━");
  try {
    const auth = await platformLogin();
    if (auth.token) {
      console.log("  ✅ Authentication successful");
      console.log(`  Token: ${auth.token.substring(0, 20)}...`);
      console.log(`  Tenant: ${auth.tenantRef}`);
      console.log(`  Workspace: ${auth.workspaceId}`);
      results.push({ test: "Authentication", status: "pass", detail: "Token received" });
    } else {
      console.log("  ❌ Authentication failed: No token returned");
      results.push({ test: "Authentication", status: "fail", detail: "No token" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Authentication error: ${msg}`);
    results.push({ test: "Authentication", status: "fail", detail: msg });
  }
  console.log();

  // Test 3: API Access (Governance State)
  console.log("━━━ Test 3: API Access ━━━");
  if (results[1]?.status === "pass") {
    try {
      const response = await fetch(`${PLATFORM_URL}/api/v1/governance/state`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        console.log("  ✅ Governance API accessible");
        console.log(`  Response keys: ${Object.keys(data).join(", ")}`);
        results.push({ test: "API Access", status: "pass", detail: `Status ${response.status}` });
      } else {
        console.log(`  ⚠️  API returned ${response.status} ${response.statusText}`);
        results.push({ test: "API Access", status: "fail", detail: `Status ${response.status}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ API access error: ${msg}`);
      results.push({ test: "API Access", status: "fail", detail: msg });
    }
  } else {
    console.log("  ⏭️  Skipped (authentication failed)");
    results.push({ test: "API Access", status: "skip", detail: "Auth failed" });
  }
  console.log();

  // Test 4: WebSocket URL
  console.log("━━━ Test 4: WebSocket URL ━━━");
  try {
    const wsUrl = getPlatformWebSocketUrl();
    console.log(`  ✅ WebSocket URL resolved: ${wsUrl}`);
    results.push({ test: "WebSocket URL", status: "pass", detail: wsUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ WebSocket URL error: ${msg}`);
    results.push({ test: "WebSocket URL", status: "fail", detail: msg });
  }
  console.log();

  // Summary
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   Test Summary                                      ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⏭️";
    console.log(`║  ${icon} ${r.test.padEnd(20)} ${r.detail.substring(0, 30).padEnd(30)} ║`);
  }
  console.log("╚══════════════════════════════════════════════════════╝");

  const passed = results.filter((r) => r.status === "pass").length;
  const total = results.length;
  console.log(`\nResult: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("\n🎉 All tests passed! The platform is fully connected.");
  } else if (passed > 0) {
    console.log("\n⚠️  Some tests failed. Check the platform URL and credentials.");
  } else {
    console.log("\n❌ All tests failed. The platform may be offline or the URL is incorrect.");
    console.log("   Set RASID_PLATFORM_URL to the correct backend URL.");
  }
}

runConnectionTests().catch(console.error);
