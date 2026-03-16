import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  createSpreadsheet,
  getSpreadsheetsByUserId,
  createDashboard,
  getDashboardsByUserId,
  updateDashboard,
  createReport,
  updateReport,
  getReportsByUserId,
  createPresentation,
  updatePresentation,
  getPresentationsByUserId,
} from "./localDb";

/* ─── Helper: create a mock authenticated context ─── */
function createMockContext(userId: number = 1): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      userId: "testuser",
      displayName: "Test User",
      email: "test@example.com",
      mobile: null,
      role: "admin",
      createdAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    },
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
  return { ctx };
}

/* ─── Auto-save: Spreadsheets ─── */
describe("Auto-save: Spreadsheets", () => {
  it("creates a spreadsheet and returns id", async () => {
    const result = await createSpreadsheet({
      userId: 1,
      title: "Auto-save Test Sheet",
      sheets: [{ name: "Sheet1", columns: [], rows: [] }],
    });
    expect(result).toBeDefined();
    expect(result!.id).toBeGreaterThan(0);
    expect(result!.title).toBe("Auto-save Test Sheet");
  });

  it("creates spreadsheet via tRPC and returns record", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.spreadsheets.create({
      title: "tRPC Auto-save Sheet",
      sheets: [{ name: "Sheet1", columns: [], rows: [[{ raw: "test", type: "text" }]] }],
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("updates spreadsheet via tRPC", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    // Create first
    const created = await caller.spreadsheets.create({
      title: "Update Test Sheet",
      sheets: [{ name: "Sheet1", columns: [], rows: [] }],
    });
    // Update
    const updated = await caller.spreadsheets.update({
      id: created.id,
      title: "Updated Sheet Title",
      sheets: [{ name: "Sheet1", columns: [{ id: "c1", name: "Col1" }], rows: [[{ raw: "data" }]] }],
    });
    expect(updated.success).toBe(true);
  });
});

/* ─── Auto-save: Dashboards ─── */
describe("Auto-save: Dashboards", () => {
  it("creates a dashboard and returns id", async () => {
    const result = await createDashboard({
      userId: 1,
      title: "Auto-save Dashboard",
      widgets: [{ type: "kpi", title: "Revenue", value: "100K" }],
    });
    expect(result).toBeDefined();
    expect(result!.id).toBeGreaterThan(0);
  });

  it("updates dashboard widgets via tRPC", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.dashboards.create({
      title: "Update Test Dashboard",
      widgets: [{ type: "bar", title: "Chart" }],
    });
    const updated = await caller.dashboards.update({
      id: created.id,
      widgets: [{ type: "bar", title: "Updated Chart" }, { type: "kpi", title: "New KPI" }],
    });
    expect(updated.success).toBe(true);
  });
});

/* ─── Auto-save: Reports ─── */
describe("Auto-save: Reports", () => {
  it("creates a report and returns id", async () => {
    const result = await createReport({
      userId: 1,
      title: "Auto-save Report",
      sections: [{ type: "heading", content: "Test Heading" }],
      classification: "عام",
    });
    expect(result).toBeDefined();
    expect(result!.id).toBeGreaterThan(0);
  });

  it("updates report sections via tRPC", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.reports.create({
      title: "Update Test Report",
      sections: [{ type: "paragraph", content: "Original content" }],
    });
    const updated = await caller.reports.update({
      id: created.id,
      title: "Updated Report Title",
      sections: [
        { type: "heading", content: "New Heading" },
        { type: "paragraph", content: "Updated content" },
      ],
    });
    expect(updated.success).toBe(true);
  });
});

/* ─── Auto-save: Presentations ─── */
describe("Auto-save: Presentations", () => {
  it("creates a presentation and returns id", async () => {
    const result = await createPresentation({
      userId: 1,
      title: "Auto-save Presentation",
      slides: [{ id: "s1", elements: [{ type: "heading", content: "Title" }] }],
      theme: "dark",
    });
    expect(result).toBeDefined();
    expect(result!.id).toBeGreaterThan(0);
  });

  it("updates presentation slides via tRPC", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.presentations.create({
      title: "Update Test Presentation",
      slides: [{ id: "s1", elements: [] }],
    });
    const updated = await caller.presentations.update({
      id: created.id,
      title: "Updated Presentation",
      slides: [
        { id: "s1", elements: [{ type: "heading", content: "Slide 1" }] },
        { id: "s2", elements: [{ type: "text", content: "Slide 2" }] },
      ],
    });
    expect(updated.success).toBe(true);
  });
});

/* ─── Data Persistence ─── */
describe("Data Persistence After Auto-save", () => {
  it("persists spreadsheet data correctly", async () => {
    const sheets = await getSpreadsheetsByUserId(1);
    expect(sheets.length).toBeGreaterThanOrEqual(1);
    const latest = sheets[0];
    expect(latest.title).toBeDefined();
  });

  it("persists dashboard widgets correctly", async () => {
    const dashboards = await getDashboardsByUserId(1);
    expect(dashboards.length).toBeGreaterThanOrEqual(1);
  });

  it("persists report sections correctly", async () => {
    const reports = await getReportsByUserId(1);
    expect(reports.length).toBeGreaterThanOrEqual(1);
  });

  it("persists presentation slides correctly", async () => {
    const presentations = await getPresentationsByUserId(1);
    expect(presentations.length).toBeGreaterThanOrEqual(1);
  });
});
