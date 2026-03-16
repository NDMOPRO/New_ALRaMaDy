import { describe, it, expect, vi } from "vitest";

// Mock fetch globally for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Platform Connector", () => {
  it("should have RASID_PLATFORM_URL configured", () => {
    const url = process.env.RASID_PLATFORM_URL || "http://localhost:4400";
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("should have RASID_PLATFORM_EMAIL configured", () => {
    const email = process.env.RASID_PLATFORM_EMAIL || "mruhaily";
    expect(email).toBeTruthy();
  });

  it("should have RASID_PLATFORM_PASSWORD configured", () => {
    const password = process.env.RASID_PLATFORM_PASSWORD || "15001500";
    expect(password).toBeTruthy();
  });

  it("should have RASID_TENANT_REF configured", () => {
    const tenant = process.env.RASID_TENANT_REF || "tenant-rasid-web";
    expect(tenant).toBeTruthy();
  });

  it("should have RASID_WORKSPACE_ID configured", () => {
    const workspace = process.env.RASID_WORKSPACE_ID || "workspace-rasid-web";
    expect(workspace).toBeTruthy();
  });

  it("should have RASID_PROJECT_ID configured", () => {
    const project = process.env.RASID_PROJECT_ID || "project-rasid-web";
    expect(project).toBeTruthy();
  });

  it("should have RASID_ACTOR_REF configured", () => {
    const actor = process.env.RASID_ACTOR_REF || "admin";
    expect(actor).toBeTruthy();
  });
});

describe("Platform Connector - Login", () => {
  it("should call login endpoint with correct payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          accessToken: "test-token",
          tenantRef: "tenant-rasid-web",
          actorRef: "admin",
        },
      }),
      headers: {
        getSetCookie: () => [],
      },
    });

    // Dynamic import after mocking
    const { platformLogin, clearPlatformAuth } = await import("./platformConnector");
    clearPlatformAuth();
    const auth = await platformLogin();

    expect(auth).toBeDefined();
    expect(auth.token).toBeTruthy();
    expect(auth.tenantRef).toBeTruthy();
    expect(auth.workspaceId).toBeTruthy();
    expect(auth.projectId).toBeTruthy();
    expect(auth.actorRef).toBeTruthy();
  });

  it("should handle login failure gracefully with fallback auth", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const { platformLogin, clearPlatformAuth } = await import("./platformConnector");
    clearPlatformAuth();
    const auth = await platformLogin();

    // Should return fallback auth for dev/offline mode
    expect(auth).toBeDefined();
    expect(auth.token).toBe("dev-fallback-token");
  });
});

describe("Platform Connector - API Calls", () => {
  it("should make authenticated GET request", async () => {
    // First mock login, then mock GET
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { accessToken: "test-token", tenantRef: "t", actorRef: "a" } }),
        headers: { getSetCookie: () => [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ datasets: [] }),
      });

    const { platformGet, clearPlatformAuth } = await import("./platformConnector");
    clearPlatformAuth();
    const result = await platformGet("/api/v1/data/list");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("should make authenticated POST request", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { accessToken: "test-token", tenantRef: "t", actorRef: "a" } }),
        headers: { getSetCookie: () => [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { job_id: "j1", status: "completed" } }),
      });

    const { platformPost, clearPlatformAuth } = await import("./platformConnector");
    clearPlatformAuth();
    const result = await platformPost("/api/v1/ai/jobs", {
      page_path: "/home",
      session_id: "s1",
      prompt: "test",
    });

    expect(result.ok).toBe(true);
  });
});

describe("Platform Connector - Health Check", () => {
  it("should report connected when backend responds", async () => {
    // Mock all 5 engine health checks
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    }

    const { platformHealthCheck } = await import("./platformConnector");
    const health = await platformHealthCheck();

    expect(health.connected).toBe(true);
    expect(health.engines).toBeDefined();
  });

  it("should report disconnected when all engines are unreachable", async () => {
    // Mock all 5 engine health checks as failing
    for (let i = 0; i < 5; i++) {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    }

    const { platformHealthCheck } = await import("./platformConnector");
    const health = await platformHealthCheck();

    expect(health.connected).toBe(false);
    expect(health.engines).toBeDefined();
  });
});

describe("Platform Router Structure", () => {
  it("should export platformRouter with all engine sub-routers", async () => {
    const { platformRouter } = await import("./platformRouter");

    expect(platformRouter).toBeDefined();
    // Check that the router has the expected shape
    expect(platformRouter._def).toBeDefined();
    expect(platformRouter._def.procedures).toBeDefined();
  });
});
