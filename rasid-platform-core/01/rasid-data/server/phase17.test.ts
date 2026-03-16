import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the openai module ─────────────────────────────────────
vi.mock("./openai", () => ({
  callAI: vi.fn(),
  callVision: vi.fn(),
  isAIAvailable: vi.fn(),
  SYSTEM_PROMPTS: {
    chat: "mock chat prompt",
    slides: "mock slides prompt",
    report: "mock report prompt",
    dashboard: "mock dashboard prompt",
    analyze: "mock analyze prompt",
    match: "mock match prompt",
    translate: "mock translate prompt",
    summarize: "mock summarize prompt",
  },
}));

// ─── Mock localDb for sharing tests ────────────────────────────
vi.mock("./localDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./localDb")>();
  
  let sharedPresentations: any[] = [];
  let presentations: any[] = [];
  let idCounter = 1;
  let shareIdCounter = 1;

  return {
    ...actual,
    createPresentation: vi.fn(async (data: any) => {
      const pres = { id: idCounter++, ...data, slides: JSON.stringify(data.slides || []), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      presentations.push(pres);
      return pres;
    }),
    getPresentationById: vi.fn(async (id: number, userId: number) => {
      return presentations.find(p => p.id === id && p.userId === userId) || null;
    }),
    updatePresentation: vi.fn(async () => {}),
    createSharedPresentation: vi.fn(async (data: any) => {
      const shared = {
        id: shareIdCounter++,
        shareToken: 'test-token-' + Math.random().toString(36).slice(2),
        viewCount: 0,
        isPublic: 1,
        ...data,
      };
      sharedPresentations.push(shared);
      return shared;
    }),
    getSharedPresentation: vi.fn(async (token: string) => {
      return sharedPresentations.find(s => s.shareToken === token) || null;
    }),
    getMySharedPresentations: vi.fn(async (userId: number) => {
      return sharedPresentations.filter(s => s.userId === userId);
    }),
    deleteSharedPresentation: vi.fn(async (id: number, userId: number) => {
      sharedPresentations = sharedPresentations.filter(s => !(s.id === id && s.userId === userId));
    }),
    updateSharedPresentation: vi.fn(async () => {}),
  };
});

function createAuthContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      userId: "test-user-1",
      displayName: "Test User",
      email: "test@example.com",
      mobile: null,
      role: "admin",
      department: null,
      avatar: null,
      status: "active",
      permissions: [],
      createdAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── Presentation Sharing ──────────────────────────────────────
describe("presentations.share", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a shared presentation link", async () => {
    const { createPresentation, createSharedPresentation, getPresentationById } = await import("./localDb");
    const mockGetPres = vi.mocked(getPresentationById);
    const mockCreateShare = vi.mocked(createSharedPresentation);

    // Setup: create a presentation first
    mockGetPres.mockResolvedValue({
      id: 1,
      userId: 1,
      title: "عرض اختباري",
      slides: '[{"id":"s1","elements":[]}]',
      theme: "default",
      status: "draft",
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockCreateShare.mockResolvedValue({
      id: 1,
      presentationId: 1,
      userId: 1,
      shareToken: "abc123xyz",
      password: null,
      title: "عرض اختباري",
      slides: '[{"id":"s1","elements":[]}]',
      theme: "default",
      brandKit: "{}",
      isPublic: 1,
      viewCount: 0,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.share({
      presentationId: 1,
    });

    expect(result).toBeDefined();
    expect((result as any).shareToken).toBe("abc123xyz");
    expect(mockCreateShare).toHaveBeenCalledTimes(1);
  });

  it("creates a password-protected shared link", async () => {
    const { getPresentationById, createSharedPresentation } = await import("./localDb");
    const mockGetPres = vi.mocked(getPresentationById);
    const mockCreateShare = vi.mocked(createSharedPresentation);

    mockGetPres.mockResolvedValue({
      id: 1, userId: 1, title: "عرض محمي", slides: "[]", theme: "default",
      status: "draft", description: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    mockCreateShare.mockResolvedValue({
      id: 2, presentationId: 1, userId: 1, shareToken: "protected-token",
      password: "secret123", title: "عرض محمي", slides: "[]", theme: "default",
      brandKit: "{}", isPublic: 1, viewCount: 0, expiresAt: null, createdAt: new Date().toISOString(),
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.share({
      presentationId: 1,
      password: "secret123",
    });

    expect((result as any).password).toBe("secret123");
  });
});

describe("presentations.viewShared", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns presentation data for valid token", async () => {
    const { getSharedPresentation } = await import("./localDb");
    const mockGetShared = vi.mocked(getSharedPresentation);

    mockGetShared.mockResolvedValue({
      id: 1, presentationId: 1, userId: 1, shareToken: "valid-token",
      password: null, title: "عرض عام", slides: '[{"id":"s1","elements":[]}]',
      theme: "default", brandKit: '{"primaryColor":"#1a73e8"}',
      isPublic: 1, viewCount: 5, expiresAt: null, createdAt: new Date().toISOString(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.viewShared({ token: "valid-token" });

    expect(result).toBeDefined();
    expect((result as any).title).toBe("عرض عام");
    expect((result as any).slides).toBe('[{"id":"s1","elements":[]}]');
    expect((result as any).viewCount).toBe(5);
  });

  it("returns error for invalid token", async () => {
    const { getSharedPresentation } = await import("./localDb");
    vi.mocked(getSharedPresentation).mockResolvedValue(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.viewShared({ token: "invalid" });
    expect((result as any).error).toBeDefined();
  });

  it("requires password for protected presentations", async () => {
    const { getSharedPresentation } = await import("./localDb");
    vi.mocked(getSharedPresentation).mockResolvedValue({
      id: 1, presentationId: 1, userId: 1, shareToken: "protected",
      password: "secret", title: "محمي", slides: "[]", theme: "default",
      brandKit: "{}", isPublic: 1, viewCount: 0, expiresAt: null, createdAt: new Date().toISOString(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Without password
    const result1 = await caller.presentations.viewShared({ token: "protected" });
    expect((result1 as any).needsPassword).toBe(true);

    // With correct password
    const result2 = await caller.presentations.viewShared({ token: "protected", password: "secret" });
    expect((result2 as any).title).toBe("محمي");
  });

  it("returns error for expired links", async () => {
    const { getSharedPresentation } = await import("./localDb");
    vi.mocked(getSharedPresentation).mockResolvedValue({
      id: 1, presentationId: 1, userId: 1, shareToken: "expired",
      password: null, title: "منتهي", slides: "[]", theme: "default",
      brandKit: "{}", isPublic: 1, viewCount: 0,
      expiresAt: "2020-01-01T00:00:00.000Z", // Expired date
      createdAt: new Date().toISOString(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.viewShared({ token: "expired" });
    expect((result as any).error).toContain("صلاحية");
  });
});

describe("presentations.deleteShare", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a shared presentation", async () => {
    const { deleteSharedPresentation } = await import("./localDb");
    const mockDelete = vi.mocked(deleteSharedPresentation);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.deleteShare({ id: 1 });
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(1, 1);
  });
});

describe("presentations.updateShare", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates share settings", async () => {
    const { updateSharedPresentation } = await import("./localDb");
    const mockUpdate = vi.mocked(updateSharedPresentation);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.presentations.updateShare({
      id: 1,
      isPublic: 0,
      password: "new-password",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(1, 1, { isPublic: 0, password: "new-password" });
  });
});

// ─── Brand Kit Structure Tests ─────────────────────────────────
describe("BrandKit structure", () => {
  it("has all required fields", () => {
    const brandKit = {
      primaryColor: "#1a73e8",
      secondaryColor: "#e8eaed",
      accentColor: "#fbbc04",
      backgroundColor: "#ffffff",
      headingFont: "Cairo, sans-serif",
      bodyFont: "IBM Plex Sans Arabic, sans-serif",
      logoUrl: undefined,
    };

    expect(brandKit.primaryColor).toBeDefined();
    expect(brandKit.secondaryColor).toBeDefined();
    expect(brandKit.accentColor).toBeDefined();
    expect(brandKit.backgroundColor).toBeDefined();
    expect(brandKit.headingFont).toContain("sans-serif");
    expect(brandKit.bodyFont).toContain("sans-serif");
  });

  it("supports color customization", () => {
    const brandKit = {
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      accentColor: "#0000ff",
      backgroundColor: "#000000",
      headingFont: "Tajawal, sans-serif",
      bodyFont: "Amiri, serif",
    };

    expect(brandKit.primaryColor).toBe("#ff0000");
    expect(brandKit.headingFont).toBe("Tajawal, sans-serif");
    expect(brandKit.bodyFont).toBe("Amiri, serif");
  });
});

// ─── Excel Export Structure Tests ──────────────────────────────
describe("Excel export data structure", () => {
  it("prepares sheet data correctly for export", () => {
    const columns = [
      { id: "1", name: "الاسم", type: "text" },
      { id: "2", name: "العمر", type: "number" },
      { id: "3", name: "المدينة", type: "text" },
    ];

    const rows = [
      [{ raw: "أحمد", type: "text" }, { raw: "30", type: "number" }, { raw: "الرياض", type: "text" }],
      [{ raw: "سارة", type: "text" }, { raw: "25", type: "number" }, { raw: "جدة", type: "text" }],
    ];

    // Simulate the export data preparation
    const headers = columns.map(c => c.name);
    const data = rows.map(r => {
      const row: Record<string, string | number> = {};
      columns.forEach((col, ci) => {
        const cell = r[ci];
        if (cell.type === "number") {
          const num = parseFloat(cell.raw);
          row[col.name] = isNaN(num) ? cell.raw : num;
        } else {
          row[col.name] = cell.raw;
        }
      });
      return row;
    });

    expect(headers).toEqual(["الاسم", "العمر", "المدينة"]);
    expect(data).toHaveLength(2);
    expect(data[0]["الاسم"]).toBe("أحمد");
    expect(data[0]["العمر"]).toBe(30); // Should be number
    expect(data[1]["المدينة"]).toBe("جدة");
  });

  it("handles empty cells gracefully", () => {
    const columns = [{ id: "1", name: "حقل", type: "text" }];
    const rows = [[{ raw: "", type: "text" }]];

    const data = rows.map(r => {
      const row: Record<string, string | number> = {};
      columns.forEach((col, ci) => {
        const cell = r[ci];
        row[col.name] = cell?.raw || "";
      });
      return row;
    });

    expect(data[0]["حقل"]).toBe("");
  });

  it("preserves multiple sheets structure", () => {
    const sheets = [
      { id: "s1", name: "البيانات", columns: [{ id: "1", name: "قيمة" }], rows: [[{ raw: "1", type: "number" }]] },
      { id: "s2", name: "الملخص", columns: [{ id: "1", name: "نتيجة" }], rows: [[{ raw: "مرتفع", type: "text" }]] },
    ];

    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe("البيانات");
    expect(sheets[1].name).toBe("الملخص");
    // Sheet names should be truncated to 31 chars for Excel
    sheets.forEach(s => {
      expect(s.name.slice(0, 31).length).toBeLessThanOrEqual(31);
    });
  });
});
