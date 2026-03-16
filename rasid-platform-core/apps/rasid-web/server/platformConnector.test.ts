import { describe, it, expect } from "vitest";

/**
 * Platform Connector — Engine connectivity tests
 * Validates that all Railway engine URLs are reachable
 */

const ENGINE_URLS = {
  report: process.env.RASID_REPORT_ENGINE_URL || "http://localhost:4310",
  presentations: process.env.RASID_PRESENTATIONS_ENGINE_URL || "http://localhost:4330",
  dashboardPublications: process.env.RASID_DASHBOARD_PUB_URL || "http://localhost:4340",
  transcription: process.env.RASID_TRANSCRIPTION_ENGINE_URL || "http://localhost:4350",
  central: process.env.RASID_PLATFORM_URL || "http://localhost:4310",
};

describe("Platform Engine Connectivity", () => {
  it("should have RASID_REPORT_ENGINE_URL set", () => {
    expect(process.env.RASID_REPORT_ENGINE_URL).toBeTruthy();
    expect(process.env.RASID_REPORT_ENGINE_URL).toContain("railway.app");
  });

  it("should have RASID_PRESENTATIONS_ENGINE_URL set", () => {
    expect(process.env.RASID_PRESENTATIONS_ENGINE_URL).toBeTruthy();
    expect(process.env.RASID_PRESENTATIONS_ENGINE_URL).toContain("railway.app");
  });

  it("should have RASID_DASHBOARD_PUB_URL set", () => {
    expect(process.env.RASID_DASHBOARD_PUB_URL).toBeTruthy();
    expect(process.env.RASID_DASHBOARD_PUB_URL).toContain("railway.app");
  });

  it("should have RASID_TRANSCRIPTION_ENGINE_URL set", () => {
    expect(process.env.RASID_TRANSCRIPTION_ENGINE_URL).toBeTruthy();
    expect(process.env.RASID_TRANSCRIPTION_ENGINE_URL).toContain("railway.app");
  });

  it("should have RASID_PLATFORM_URL set", () => {
    expect(process.env.RASID_PLATFORM_URL).toBeTruthy();
    expect(process.env.RASID_PLATFORM_URL).toContain("railway.app");
  });

  it("should reach report engine login endpoint", async () => {
    const res = await fetch(`${ENGINE_URLS.report}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin", password: "1500" }),
      signal: AbortSignal.timeout(15000),
    });
    // 200 = login success
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.accessToken).toBeTruthy();
  }, 20000);

  it("should reach presentations engine login endpoint", async () => {
    const res = await fetch(`${ENGINE_URLS.presentations}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin", password: "1500" }),
      signal: AbortSignal.timeout(15000),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.accessToken).toBeTruthy();
  }, 20000);

  it("should reach dashboard publications service", async () => {
    const res = await fetch(`${ENGINE_URLS.dashboardPublications}/`, {
      signal: AbortSignal.timeout(10000),
    });
    // 404 is expected (no publications yet), but the service is reachable
    expect([200, 404]).toContain(res.status);
  }, 15000);

  it("should reach transcription engine login endpoint", async () => {
    const res = await fetch(`${ENGINE_URLS.transcription}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin", password: "1500" }),
      signal: AbortSignal.timeout(15000),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.accessToken).toBeTruthy();
  }, 20000);
});
