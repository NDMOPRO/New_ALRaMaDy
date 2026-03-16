import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the openai module ─────────────────────────────────────
vi.mock("./openai", () => ({
  callAI: vi.fn(),
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

import { callAI, isAIAvailable } from "./openai";
const mockCallAI = vi.mocked(callAI);
const mockIsAIAvailable = vi.mocked(isAIAvailable);

// ─── Helper: create a public context (no auth needed) ───────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── AI Status ──────────────────────────────────────────────────
describe("ai.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns available=true with openai source when key is configured", async () => {
    mockIsAIAvailable.mockReturnValue({ available: true, source: "openai" });
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.status();
    expect(result).toEqual({ available: true, source: "openai" });
  });

  it("returns available=true with forge source as fallback", async () => {
    mockIsAIAvailable.mockReturnValue({ available: true, source: "forge" });
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.status();
    expect(result).toEqual({ available: true, source: "forge" });
  });

  it("returns available=false when no AI is configured", async () => {
    mockIsAIAvailable.mockReturnValue({ available: false, source: "none" });
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.status();
    expect(result).toEqual({ available: false, source: "none" });
  });
});

// ─── AI Chat ────────────────────────────────────────────────────
describe("ai.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends messages to AI and returns response", async () => {
    mockCallAI.mockResolvedValue({
      content: "مرحباً! أنا راصد الذكي.",
      model: "gpt-4o-mini",
      source: "openai",
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.chat({
      messages: [{ role: "user", content: "مرحباً" }],
    });

    expect(result.content).toBe("مرحباً! أنا راصد الذكي.");
    expect(result.source).toBe("openai");
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    // Verify system prompt is prepended
    const callArgs = mockCallAI.mock.calls[0]![0];
    expect(callArgs[0]!.role).toBe("system");
    expect(callArgs[1]!.role).toBe("user");
    expect(callArgs[1]!.content).toBe("مرحباً");
  });

  it("includes context in system prompt when provided", async () => {
    mockCallAI.mockResolvedValue({
      content: "تحليل البيانات...",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.chat({
      messages: [{ role: "user", content: "حلل البيانات" }],
      context: "بيانات الجهات الحكومية",
    });

    const systemMsg = mockCallAI.mock.calls[0]![0][0]!;
    expect(systemMsg.content).toContain("بيانات الجهات الحكومية");
  });
});

// ─── Generate Slides ────────────────────────────────────────────
describe("ai.generateSlides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates slides from prompt and returns parsed JSON", async () => {
    const slidesData = {
      slides: [
        { title: "المقدمة", subtitle: "", content: "محتوى تجريبي", notes: "ملاحظات", layout: "title" },
        { title: "النتائج", subtitle: "", content: "نتائج التحليل", notes: "ملاحظات", layout: "content" },
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(slidesData),
      model: "gpt-4o-mini",
      source: "openai",
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateSlides({
      prompt: "عرض عن حوكمة البيانات",
      slideCount: 2,
    });

    expect(result.slides).toHaveLength(2);
    expect(result.slides[0]!.title).toBe("المقدمة");
    expect(result.source).toBe("openai");
  });

  it("returns empty slides array on invalid JSON", async () => {
    mockCallAI.mockResolvedValue({
      content: "not valid json",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateSlides({
      prompt: "عرض تجريبي",
    });

    expect(result.slides).toEqual([]);
    expect(result.raw).toBe("not valid json");
  });
});

// ─── Generate Report ────────────────────────────────────────────
describe("ai.generateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates report sections from prompt", async () => {
    const reportData = {
      sections: [
        { type: "cover", title: "غلاف التقرير", content: "تقرير الامتثال", priority: "high" },
        { type: "paragraph", title: "الملخص التنفيذي", content: "ملخص...", priority: "high" },
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(reportData),
      model: "gpt-4o-mini",
      source: "openai",
      usage: { prompt_tokens: 80, completion_tokens: 150, total_tokens: 230 },
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateReport({
      prompt: "تقرير امتثال البيانات",
      reportType: "امتثال",
    });

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]!.type).toBe("cover");
  });
});

// ─── Analyze Dashboard ──────────────────────────────────────────
describe("ai.analyzeDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suggests dashboard widgets based on prompt", async () => {
    const dashboardData = {
      widgets: [
        { type: "kpi", title: "نسبة الامتثال", description: "متوسط الامتثال" },
        { type: "bar", title: "مقارنة الجهات", description: "مقارنة بيانية" },
      ],
      suggestion: "أضف مؤشر أداء رئيسي",
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(dashboardData),
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.analyzeDashboard({
      prompt: "أنشئ لوحة مؤشرات للامتثال",
    });

    expect(result.widgets).toHaveLength(2);
    expect(result.suggestion).toBe("أضف مؤشر أداء رئيسي");
  });
});

// ─── Analyze Data ───────────────────────────────────────────────
describe("ai.analyzeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("analyzes data and returns AI response", async () => {
    mockCallAI.mockResolvedValue({
      content: "تحليل: متوسط الامتثال 85%",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.analyzeData({
      prompt: "حلل بيانات الامتثال",
      data: "وزارة المالية: 94%, وزارة الصحة: 88%",
      columns: ["الجهة", "نسبة الامتثال"],
    });

    expect(result.content).toContain("85%");
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });
});

// ─── Translation ────────────────────────────────────────────────
describe("ai.translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates text between languages", async () => {
    mockCallAI.mockResolvedValue({
      content: "Data Governance Framework",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.translate({
      text: "إطار حوكمة البيانات",
      from: "العربية",
      to: "English",
    });

    expect(result.content).toBe("Data Governance Framework");
  });

  it("defaults to Arabic when no target language specified", async () => {
    mockCallAI.mockResolvedValue({
      content: "إطار حوكمة البيانات",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.translate({
      text: "Data Governance Framework",
    });

    const userMsg = mockCallAI.mock.calls[0]![0].find((m) => m.role === "user");
    expect(userMsg!.content).toContain("إلى العربية");
  });
});

// ─── Summarize ──────────────────────────────────────────────────
describe("ai.summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes text content", async () => {
    mockCallAI.mockResolvedValue({
      content: "ملخص: تقرير يتضمن 5 نقاط رئيسية",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.summarize({
      text: "نص طويل جداً يحتاج إلى تلخيص...",
      maxLength: 100,
    });

    expect(result.content).toContain("ملخص");
  });
});

// ─── CDR Matching ───────────────────────────────────────────────
describe("ai.matchSuggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suggests matching strategies", async () => {
    mockCallAI.mockResolvedValue({
      content: "استراتيجية المطابقة: مطابقة حرفية بنسبة 100%",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.matchSuggest({
      prompt: "طابق بيانات الجهات",
      sourceData: "وزارة المالية",
      targetData: "Ministry of Finance",
    });

    expect(result.content).toContain("مطابقة");
  });
});
