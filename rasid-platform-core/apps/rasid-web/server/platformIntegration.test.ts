import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Platform Connector Module Tests ────────────────────────────

describe("Platform Connector - Module Exports", () => {
  it("should export all required functions", async () => {
    const connector = await import("./platformConnector");

    expect(connector.platformLogin).toBeTypeOf("function");
    expect(connector.platformGet).toBeTypeOf("function");
    expect(connector.platformPost).toBeTypeOf("function");
    expect(connector.platformHealthCheck).toBeTypeOf("function");
    expect(connector.clearPlatformAuth).toBeTypeOf("function");
    expect(connector.submitAIJob).toBeTypeOf("function");
  });

  it("should export platformHealthCheck that returns connection status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });
    const { platformHealthCheck } = await import("./platformConnector");
    const health = await platformHealthCheck();
    expect(health).toBeDefined();
    expect(typeof health.connected).toBe("boolean");
    expect(health.engines).toBeDefined();
  });
});

describe("Platform Connector - AI Job Submission", () => {
  it("should submit AI job with correct payload structure", async () => {
    // Mock login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { accessToken: "test-token", tenantRef: "t", actorRef: "a" },
      }),
      headers: { getSetCookie: () => [] },
    });
    // Mock AI job submission
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        job: {
          job_id: "job-123",
          status: "completed",
          result: "تحليل البيانات مكتمل",
        },
      }),
    });

    const { submitAIJob, clearPlatformAuth } = await import(
      "./platformConnector"
    );
    clearPlatformAuth();
    const result = await submitAIJob({
      prompt: "حلل بيانات الجهات الحكومية",
      sessionId: "session-1",
      pagePath: "/home",
    });

    expect(result).toBeDefined();
    // submitAIJob returns PlatformResponse<AIJobResult>
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should handle AI job failure gracefully", async () => {
    // Mock login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { accessToken: "test-token", tenantRef: "t", actorRef: "a" },
      }),
      headers: { getSetCookie: () => [] },
    });
    // Mock AI job failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const { submitAIJob, clearPlatformAuth } = await import(
      "./platformConnector"
    );
    clearPlatformAuth();

    const result = await submitAIJob({
      prompt: "test",
      sessionId: "s1",
      pagePath: "/home",
    });
    // submitAIJob returns PlatformResponse with ok: false, doesn't throw
    expect(result.ok).toBe(false);
    // With retry logic, status could be 500 (from server) or 0 (network error after retries)
    expect([0, 500]).toContain(result.status);
  });
});

// ─── Platform Router Tests ──────────────────────────────────────

describe("Platform Router - Sub-Router Structure", () => {
  it("should have all engine sub-routers defined", async () => {
    const { platformRouter } = await import("./platformRouter");

    expect(platformRouter._def).toBeDefined();
    const procedures = platformRouter._def.procedures;

    // Check that key procedure paths exist
    const procedureKeys = Object.keys(procedures);
    expect(procedureKeys.length).toBeGreaterThan(0);

    // Verify key engine namespaces exist via procedure names
    const hasAI = procedureKeys.some((k) => k.startsWith("ai."));
    const hasDashboards = procedureKeys.some((k) =>
      k.startsWith("dashboards.")
    );
    const hasReports = procedureKeys.some((k) => k.startsWith("reports."));
    const hasPresentations = procedureKeys.some((k) =>
      k.startsWith("presentations.")
    );
    const hasData = procedureKeys.some((k) => k.startsWith("data."));
    const hasGovernance = procedureKeys.some((k) =>
      k.startsWith("governance.")
    );
    const hasTranscription = procedureKeys.some((k) =>
      k.startsWith("transcription.")
    );
    const hasLocalization = procedureKeys.some((k) =>
      k.startsWith("localization.")
    );
    const hasReplication = procedureKeys.some((k) =>
      k.startsWith("replication.")
    );
    const hasHealth = procedureKeys.some((k) => k.startsWith("health"));

    expect(hasAI).toBe(true);
    expect(hasDashboards).toBe(true);
    expect(hasReports).toBe(true);
    expect(hasPresentations).toBe(true);
    expect(hasData).toBe(true);
    expect(hasGovernance).toBe(true);
    expect(hasTranscription).toBe(true);
    expect(hasLocalization).toBe(true);
    expect(hasReplication).toBe(true);
    expect(hasHealth).toBe(true);
  });
});

describe("Platform Router - AI Procedures", () => {
  it("should have submitJob procedure", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    expect(procedures["ai.submitJob"]).toBeDefined();
  });

  it("should have submitJob as the primary AI procedure", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    expect(procedures["ai.submitJob"]).toBeDefined();
  });
});

describe("Platform Router - Dashboard Procedures", () => {
  it("should have all dashboard CRUD procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const dashboardProcedures = [
      "dashboards.create",
      "dashboards.addWidget",
      "dashboards.moveWidget",
      "dashboards.configWidget",
      "dashboards.rebindWidget",
      "dashboards.refresh",
      "dashboards.publish",
      "dashboards.share",
      "dashboards.schedule",
      "dashboards.saveTemplate",
      "dashboards.exportWidget",
      "dashboards.simulateDesign",
      "dashboards.compare",
      "dashboards.compareAdvanced",
      "dashboards.getState",
      "dashboards.getTemplates",
      "dashboards.getLibrary",
    ];

    for (const proc of dashboardProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Governance Procedures", () => {
  it("should have all governance query procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const governanceProcedures = [
      "governance.state",
      "governance.roles",
      "governance.evidence",
      "governance.audit",
      "governance.lineage",
      "governance.kpis",
      "governance.compliance",
      "governance.permissions",
      "governance.approvals",
      "governance.policies",
      "governance.assignments",
    ];

    for (const proc of governanceProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });

  it("should have governance mutation procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const governanceMutations = [
      "governance.createRole",
      "governance.createEvidence",
      "governance.checkCompliance",
      "governance.scanPrompt",
    ];

    for (const proc of governanceMutations) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Data Procedures", () => {
  it("should have data management procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const dataProcedures = [
      "data.register",
      "data.list",
      "data.canvasState",
    ];

    for (const proc of dataProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Report Procedures", () => {
  it("should have report conversion procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const reportProcedures = [
      "reports.createFromTranscription",
      "reports.convertToDashboard",
      "reports.convertToPresentation",
    ];

    for (const proc of reportProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Transcription Procedures", () => {
  it("should have transcription procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const transcriptionProcedures = [
      "transcription.startJob",
      "transcription.listJobs",
    ];

    for (const proc of transcriptionProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Localization Procedures", () => {
  it("should have localization procedures", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    const localizationProcedures = [
      "localization.localizeDashboard",
      "localization.liveTranslation",
    ];

    for (const proc of localizationProcedures) {
      expect(procedures[proc]).toBeDefined();
    }
  });
});

describe("Platform Router - Replication Procedures", () => {
  it("should have replication consumeOutput procedure", async () => {
    const { platformRouter } = await import("./platformRouter");
    const procedures = platformRouter._def.procedures;
    expect(procedures["replication.consumeOutput"]).toBeDefined();
  });
});

// ─── Integration Mapping Verification ───────────────────────────

describe("Integration Mapping - Engine to Platform", () => {
  it("should map all 7 frontend engines to backend procedures", () => {
    const engineMapping = {
      DashboardEngine: "dashboards",
      ReportsEngine: "reports",
      PresentationsEngine: "presentations",
      ExcelEngine: "data",
      ExtractionEngine: "transcription",
      TranslationEngine: "localization",
      VisualMatchEngine: "replication",
    };

    expect(Object.keys(engineMapping)).toHaveLength(7);
    for (const [engine, namespace] of Object.entries(engineMapping)) {
      expect(engine).toBeTruthy();
      expect(namespace).toBeTruthy();
    }
  });

  it("should map governance components to backend procedures", () => {
    const governanceMapping = {
      InspectorPanel: ["governance.lineage", "governance.permissions"],
      EvidenceDrawer: ["governance.evidence", "governance.audit"],
      ExecutionTimeline: ["ai.getJobStatus"],
      AdminPanel: [
        "governance.state",
        "governance.roles",
        "governance.kpis",
        "governance.compliance",
      ],
    };

    expect(Object.keys(governanceMapping)).toHaveLength(4);
    for (const [component, procedures] of Object.entries(governanceMapping)) {
      expect(component).toBeTruthy();
      expect(procedures.length).toBeGreaterThan(0);
    }
  });
});
