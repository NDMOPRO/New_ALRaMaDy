import { describe, it, expect, beforeAll } from "vitest";

/**
 * Live connection test — validates that the platform credentials
 * and URL are correctly configured by making real HTTP calls
 * to the running ALRaMaDy backend.
 */

const PLATFORM_URL = process.env.RASID_PLATFORM_URL || "http://localhost:4310";
const PLATFORM_EMAIL = process.env.RASID_PLATFORM_EMAIL || "admin";
const PLATFORM_PASSWORD = process.env.RASID_PLATFORM_PASSWORD || "1500";
const TENANT_REF = process.env.RASID_TENANT_REF || "tenant-dashboard-web";
const WORKSPACE_ID = process.env.RASID_WORKSPACE_ID || "workspace-dashboard-web";
const PROJECT_ID = process.env.RASID_PROJECT_ID || "project-dashboard-web";
const ACTOR_REF = process.env.RASID_ACTOR_REF || "admin";

let isBackendRunning = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${PLATFORM_URL}/login`, { redirect: "manual" });
    isBackendRunning = res.status === 200 || res.status === 302;
  } catch {
    isBackendRunning = false;
  }
});

describe("Live Backend Connection", () => {
  it("should reach the backend server", () => {
    expect(isBackendRunning).toBe(true);
  });

  it("should authenticate with correct credentials", async () => {
    if (!isBackendRunning) return;

    const response = await fetch(`${PLATFORM_URL}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: PLATFORM_EMAIL,
        password: PLATFORM_PASSWORD,
        tenant_ref: TENANT_REF,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        actor_ref: ACTOR_REF,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.accessToken).toBeTruthy();
    expect(data.data.tenantRef).toBe(TENANT_REF);
    expect(data.data.actorRef).toBe(ACTOR_REF);
  });

  it("should reject wrong credentials", async () => {
    if (!isBackendRunning) return;

    const response = await fetch(`${PLATFORM_URL}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "wrong-user",
        password: "wrong-pass",
        tenant_ref: TENANT_REF,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        actor_ref: ACTOR_REF,
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("should access authenticated API endpoints after login", async () => {
    if (!isBackendRunning) return;

    // First login to get the token
    const loginRes = await fetch(`${PLATFORM_URL}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: PLATFORM_EMAIL,
        password: PLATFORM_PASSWORD,
        tenant_ref: TENANT_REF,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        actor_ref: ACTOR_REF,
      }),
    });

    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;

    // Try to access the governance state endpoint
    const stateRes = await fetch(`${PLATFORM_URL}/api/v1/governance/state`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cookie": [
          `rasid_auth=${token}`,
          `rasid_tenant=${TENANT_REF}`,
          `rasid_workspace=${WORKSPACE_ID}`,
          `rasid_project=${PROJECT_ID}`,
          `rasid_actor=${ACTOR_REF}`,
        ].join("; "),
      },
    });

    // Should get a valid response (200 or 404 for not-found is OK, 401 means auth failed)
    expect(stateRes.status).not.toBe(401);
  });
});
