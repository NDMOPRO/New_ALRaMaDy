import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, createUser, getUserByUserId, createFile, getFilesByUserId, createReport, getReportsByUserId, createPresentation, getPresentationsByUserId, createDashboard, getDashboardsByUserId, createSpreadsheet, getSpreadsheetsByUserId, getLibraryItems } from "./localDb";
import { hashPassword, verifyPassword } from "./localAuth";

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

/* ─── Database Tests ─── */
describe("SQLite Local Database", () => {
  it("initializes database with all tables", async () => {
    const db = await getDb();
    expect(db).toBeDefined();
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.length).toBeGreaterThan(0);
    const tableNames = tables[0].values.map((r: any) => r[0]);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("files");
    expect(tableNames).toContain("reports");
    expect(tableNames).toContain("presentations");
    expect(tableNames).toContain("dashboards");
    expect(tableNames).toContain("spreadsheets");
    // library_items is an aggregated view, not a separate table
    expect(tableNames).toContain("extractions");
  });

  it("creates and retrieves a user", async () => {
    await createUser({ userId: "testuser2", passwordHash: "hashedpw", displayName: "Test User 2", email: "test2@test.com", mobile: "+966500000000" });
    const user = await getUserByUserId("testuser2");
    expect(user).toBeDefined();
    expect(user!.displayName).toBe("Test User 2");
    expect(user!.email).toBe("test2@test.com");
  });

  it("creates and retrieves files", async () => {
    await createFile({ userId: 1, title: "test.xlsx", type: "file", category: "excel", icon: "table_chart", size: "1 KB", filePath: "/uploads/test.xlsx" });
    const files = await getFilesByUserId(1);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f: any) => f.title === "test.xlsx")).toBe(true);
  });

  it("creates and retrieves reports", async () => {
    const report = await createReport({ userId: 1, title: "Test Report", sections: [{ type: "text", content: "Hello" }] });
    expect(report.id).toBeGreaterThan(0);
    const reports = await getReportsByUserId(1);
    expect(reports.length).toBeGreaterThanOrEqual(1);
  });

  it("creates and retrieves presentations", async () => {
    const pres = await createPresentation({ userId: 1, title: "Test Presentation", slides: [{ id: "s1", elements: [] }] });
    expect(pres.id).toBeGreaterThan(0);
    const presentations = await getPresentationsByUserId(1);
    expect(presentations.length).toBeGreaterThanOrEqual(1);
  });

  it("creates and retrieves dashboards", async () => {
    const dash = await createDashboard({ userId: 1, title: "Test Dashboard", widgets: [{ type: "kpi", title: "Revenue" }] });
    expect(dash.id).toBeGreaterThan(0);
    const dashboards = await getDashboardsByUserId(1);
    expect(dashboards.length).toBeGreaterThanOrEqual(1);
  });

  it("creates and retrieves spreadsheets", async () => {
    await createSpreadsheet({ userId: 1, title: "Test Sheet", sheets: [{ rows: [], cols: [] }] });
    const sheets = await getSpreadsheetsByUserId(1);
    expect(sheets.length).toBeGreaterThanOrEqual(1);
  });

  it("retrieves library items (aggregated view)", async () => {
    // Library is an aggregated view of files, reports, presentations, dashboards
    // Items were created in previous tests so library should have entries
    const items = await getLibraryItems(1);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

/* ─── Auth Tests ─── */
describe("Local Authentication", () => {
  it("hashes and verifies passwords correctly", async () => {
    const password = "15001500";
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPassword("wrongpassword", hash);
    expect(isInvalid).toBe(false);
  });
});

/* ─── tRPC Router Tests ─── */
describe("tRPC Routes - Real Data", () => {
  it("auth.me returns user when authenticated", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result!.userId).toBe("testuser");
  });

  it("auth.me returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { clearCookie: () => {}, cookie: () => {} } as any,
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("files.list returns files for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const files = await caller.files.list();
    expect(Array.isArray(files)).toBe(true);
  });

  it("reports.list returns reports for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const reports = await caller.reports.list();
    expect(Array.isArray(reports)).toBe(true);
  });

  it("reports.create creates a new report", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const report = await caller.reports.create({
      title: "New Test Report",
      sections: [{ type: "heading", content: "Test" }],
    });
    expect(report).toBeDefined();
    expect(report.id).toBeGreaterThan(0);
  });

  it("presentations.list returns presentations for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const presentations = await caller.presentations.list();
    expect(Array.isArray(presentations)).toBe(true);
  });

  it("presentations.create creates a new presentation", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const pres = await caller.presentations.create({
      title: "New Test Presentation",
      slides: [{ id: "s1", elements: [] }],
    });
    expect(pres).toBeDefined();
    expect(pres.id).toBeGreaterThan(0);
  });

  it("dashboards.list returns dashboards for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const dashboards = await caller.dashboards.list();
    expect(Array.isArray(dashboards)).toBe(true);
  });

  it("dashboards.create creates a new dashboard", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const dash = await caller.dashboards.create({
      title: "New Test Dashboard",
      widgets: [{ type: "kpi" }],
    });
    expect(dash).toBeDefined();
    expect(dash.id).toBeGreaterThan(0);
  });

  it("spreadsheets.list returns spreadsheets for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const sheets = await caller.spreadsheets.list();
    expect(Array.isArray(sheets)).toBe(true);
  });

  it("library.items returns library items for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const items = await caller.library.items();
    expect(Array.isArray(items)).toBe(true);
  });

  it("ai.status returns AI availability", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const status = await caller.ai.status();
    expect(status).toHaveProperty("available");
    expect(typeof status.available).toBe("boolean");
  });
});
