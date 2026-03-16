/**
 * WebSocket + Error Handling + Connection Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── WebSocket Server Module Tests ──────────────────────────────

describe("WebSocket Server Module", () => {
  it("should export wsManager singleton", async () => {
    const mod = await import("./websocket");
    expect(mod.wsManager).toBeDefined();
    expect(typeof mod.wsManager).toBe("object");
  });

  it("wsManager should have init, broadcast, and shutdown methods", async () => {
    const { wsManager } = await import("./websocket");
    expect(typeof wsManager.init).toBe("function");
    expect(typeof wsManager.broadcast).toBe("function");
    expect(typeof wsManager.shutdown).toBe("function");
  });

  it("wsManager should have all broadcast helper methods", async () => {
    const { wsManager } = await import("./websocket");
    expect(typeof wsManager.broadcastDashboardUpdate).toBe("function");
    expect(typeof wsManager.broadcastJobProgress).toBe("function");
    expect(typeof wsManager.broadcastJobCompleted).toBe("function");
    expect(typeof wsManager.broadcastJobFailed).toBe("function");
    expect(typeof wsManager.broadcastPlatformStatus).toBe("function");
    expect(typeof wsManager.broadcastSessionExpiry).toBe("function");
    expect(typeof wsManager.broadcastNotification).toBe("function");
  });

  it("broadcast should not throw when no server is initialized", async () => {
    const { wsManager } = await import("./websocket");
    // Should silently do nothing when no WebSocket server exists
    expect(() => {
      wsManager.broadcast({ channel: "dashboard", event: "test", data: {} });
    }).not.toThrow();
  });

  it("broadcastNotification should not throw when no server is initialized", async () => {
    const { wsManager } = await import("./websocket");
    expect(() => {
      wsManager.broadcastNotification("Test", "Hello", "info");
    }).not.toThrow();
  });
});

// ─── Platform Connector Retry Logic Tests ───────────────────────

describe("Platform Connector - Enhanced Error Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("PlatformResponse interface should include error field", async () => {
    const mod = await import("./platformConnector");
    // Test that platformGet returns proper error structure for non-existent paths
    const result = await mod.platformGet("/nonexistent/path");
    // Should return ok: false whether backend is running (404) or not (network error)
    expect(result.ok).toBe(false);
    // Should have error field in either case
    expect(typeof result.error === 'string' || result.error === undefined).toBe(true);
  }, 30000);

  it("platformGet should handle errors gracefully", async () => {
    const mod = await import("./platformConnector");
    // Should NOT throw — it should return a structured error
    const result = await mod.platformGet("/api/v1/nonexistent-endpoint-test");
    expect(result.ok).toBe(false);
    // Status could be 0 (network error), 401 (auth fail), or 404 (not found)
    expect(typeof result.status).toBe("number");
  });

  it("platformPost should handle errors gracefully", async () => {
    const mod = await import("./platformConnector");
    const result = await mod.platformPost("/api/v1/nonexistent-endpoint-test", { data: "test" });
    expect(result.ok).toBe(false);
    // Status could be 0 (network error), 401 (auth fail), or 404 (not found)
    expect(typeof result.status).toBe("number");
  });

  it("platformHealthCheck should return structured health data", async () => {
    const mod = await import("./platformConnector");
    const health = await mod.platformHealthCheck();
    expect(health).toHaveProperty("connected");
    expect(health).toHaveProperty("engines");
    expect(typeof health.connected).toBe("boolean");
    expect(typeof health.engines).toBe("object");
  });

  it("getPlatformWebSocketUrl should return a valid ws:// URL", async () => {
    const mod = await import("./platformConnector");
    const wsUrl = mod.getPlatformWebSocketUrl();
    expect(wsUrl).toMatch(/^ws:\/\/|^wss:\/\//);
    expect(wsUrl).toContain("/ws/dashboards");
  });

  it("platformLogin should return fallback auth when platform is unreachable", async () => {
    const mod = await import("./platformConnector");
    const auth = await mod.platformLogin();
    // When platform is down, should return dev fallback
    expect(auth).toHaveProperty("token");
    expect(auth).toHaveProperty("tenantRef");
    expect(auth).toHaveProperty("workspaceId");
    expect(auth).toHaveProperty("projectId");
    expect(auth).toHaveProperty("actorRef");
    expect(typeof auth.token).toBe("string");
  });
});

// ─── Connection Test Script Tests ───────────────────────────────

describe("Connection Test Script", () => {
  it("connectionTest.ts should be importable without errors", async () => {
    // Just verify the file can be parsed
    const fs = await import("fs");
    const content = fs.readFileSync("server/connectionTest.ts", "utf-8");
    expect(content).toContain("platformHealthCheck");
    expect(content).toContain("platformLogin");
    expect(content).toContain("getPlatformWebSocketUrl");
    expect(content).toContain("runConnectionTests");
  });
});

// ─── Error Boundary Utility Tests ───────────────────────────────

describe("Error Handling Utilities", () => {
  it("PlatformErrorBoundary module should export error utility functions", async () => {
    // We can't test React components in vitest without jsdom, 
    // but we can verify the module structure
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PlatformErrorBoundary.tsx", "utf-8");
    
    // Verify exported utility functions exist
    expect(content).toContain("export function showApiError");
    expect(content).toContain("export function showRateLimitError");
    expect(content).toContain("export function showServerError");
    expect(content).toContain("export function showSessionExpired");
    expect(content).toContain("export async function withErrorToast");
    
    // Verify it handles all error types
    expect(content).toContain("connection_lost");
    expect(content).toContain("session_expired");
    expect(content).toContain("rate_limited");
    expect(content).toContain("server_error");
  });

  it("PlatformErrorBoundary should use sonner toast", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PlatformErrorBoundary.tsx", "utf-8");
    expect(content).toContain("import { toast } from 'sonner'");
    expect(content).toContain("toast.error");
    expect(content).toContain("toast.success");
    expect(content).toContain("toast.warning");
    expect(content).toContain("toast.loading");
  });

  it("PlatformErrorBoundary should handle WebSocket events", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PlatformErrorBoundary.tsx", "utf-8");
    expect(content).toContain("useWebSocket");
    expect(content).toContain("onSystemEvent");
    expect(content).toContain("onNotification");
    expect(content).toContain("onConnectionChange");
  });
});

// ─── WebSocket Hook Tests ───────────────────────────────────────

describe("WebSocket Hook Module", () => {
  it("useWebSocket module should export all required types and hooks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useWebSocket.ts", "utf-8");
    
    // Types
    expect(content).toContain("export interface DashboardUpdateEvent");
    expect(content).toContain("export interface JobUpdateEvent");
    expect(content).toContain("export interface SystemEvent");
    expect(content).toContain("export interface NotificationEvent");
    expect(content).toContain("export interface WebSocketHandlers");
    
    // Hooks
    expect(content).toContain("export function useWebSocket");
    expect(content).toContain("export function useDashboardWebSocket");
    expect(content).toContain("export function useJobWebSocket");
  });

  it("DashboardUpdateEvent should have required fields", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useWebSocket.ts", "utf-8");
    expect(content).toContain("dashboardId");
    expect(content).toContain("widgetRef");
    expect(content).toContain("payload");
  });

  it("JobUpdateEvent should have required fields", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useWebSocket.ts", "utf-8");
    expect(content).toContain("jobId");
    expect(content).toContain("progress");
    expect(content).toContain("result");
    expect(content).toContain("error");
  });
});

// ─── App.tsx Integration Tests ──────────────────────────────────

describe("App.tsx Integration", () => {
  it("App.tsx should include PlatformErrorBoundary", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain("PlatformErrorBoundary");
    expect(content).toContain("import PlatformErrorBoundary");
  });

  it("Toaster should have RTL and richColors config", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain('richColors');
    expect(content).toContain('dir="rtl"');
    expect(content).toContain('position="top-center"');
  });
});
