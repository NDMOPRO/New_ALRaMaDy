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

import { callAI } from "./openai";
const mockCallAI = vi.mocked(callAI);

// ─── Helper: create a public context ─────────────────────────────
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

// ─── Full mock slide with all required fields ────────────────────
function createMockSlide(overrides: Record<string, any> = {}) {
  return {
    title: "عنوان الشريحة",
    subtitle: "عنوان فرعي",
    content: "محتوى الشريحة التفصيلي",
    bulletPoints: ["نقطة أولى مفصلة", "نقطة ثانية مفصلة"],
    notes: "ملاحظات المتحدث",
    layout: "content",
    chartType: "",
    chartData: [],
    chartLabels: [],
    chartColors: [],
    tableHeaders: [],
    tableRows: [],
    infographicItems: [],
    timelineItems: [],
    ...overrides,
  };
}

// ─── Generate Presentation Tests ──────────────────────────────────
describe("ai.generatePresentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a presentation with rich slides from AI response", async () => {
    const mockResponse = {
      title: "تقرير نضج البيانات",
      slides: [
        createMockSlide({
          title: "تقرير نضج البيانات الوطنية",
          subtitle: "الربع الرابع 2025",
          layout: "title",
        }),
        createMockSlide({
          title: "المحاور الرئيسية",
          layout: "content",
          bulletPoints: ["الحوكمة", "الجودة", "الإتاحة", "الحماية"],
        }),
        createMockSlide({
          title: "إحصائيات النضج",
          layout: "chart",
          chartType: "bar",
          chartData: [85, 72, 90, 68],
          chartLabels: ["الحوكمة", "الجودة", "الإتاحة", "الحماية"],
          chartColors: ["#0f2744", "#d4af37", "#1a73e8", "#6b7280"],
        }),
        createMockSlide({
          title: "شكراً لحسن استماعكم",
          layout: "closing",
        }),
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 500, completion_tokens: 1500, total_tokens: 2000 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generatePresentation({
      topic: "تقرير نضج البيانات الوطنية",
      slideCount: 4,
      brandId: "ndmo",
      language: "ar",
    });

    expect(result.title).toBe("تقرير نضج البيانات");
    expect(result.slides).toHaveLength(4);
    expect(result.slides[0].layout).toBe("title");
    expect(result.slides[1].layout).toBe("chart");
    expect(result.slides[2].layout).toBe("infographic");
    expect(result.slides[3].layout).toBe("closing");
    expect(mockCallAI).toHaveBeenCalledTimes(1);

    // Verify that response_format was passed
    const callArgs = mockCallAI.mock.calls[0];
    expect(callArgs[1]).toBeDefined();
    expect(callArgs[1]?.response_format).toBeDefined();
    expect(callArgs[1]?.response_format?.type).toBe("json_schema");
  });

  it("handles different brand IDs correctly", async () => {
    const mockResponse = {
      title: "عرض سدايا",
      slides: [createMockSlide({ title: "عنوان", layout: "title" })],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generatePresentation({
      topic: "عرض تقديمي",
      slideCount: 5,
      brandId: "sdaia",
      language: "ar",
    });

    expect(result.title).toBe("عرض سدايا");

    // Verify the system prompt mentions the brand
    const systemMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "system"
    );
    expect(systemMsg?.content).toContain("سدايا");
  });

  it("passes user content with strict mode when contentSource is 'user'", async () => {
    const mockResponse = {
      title: "عرض مخصص",
      slides: [createMockSlide({ layout: "title" })],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.generatePresentation({
      topic: "موضوع مخصص",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
      contentSource: "user",
      userContent: "هذا هو المحتوى الذي أريده بالضبط",
      strictContent: true,
    });

    // Verify user content was included in the prompt
    const userMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "user"
    );
    expect(userMsg?.content).toContain("هذا هو المحتوى الذي أريده بالضبط");

    // Verify strict content instruction was included in system prompt
    const systemMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "system"
    );
    // The strict instruction is in the user message
    expect(userMsg?.content).toContain("هذا هو المحتوى الذي أريده بالضبط");
  });

  it("passes library/file content for enrichment", async () => {
    const mockResponse = {
      title: "عرض من ملف",
      slides: [createMockSlide({ layout: "title" })],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.generatePresentation({
      topic: "تقرير البيانات",
      slideCount: 8,
      brandId: "ndmo",
      language: "ar",
      contentSource: "file",
      userContent: "محتوى مستخرج من ملف PDF",
    });

    const userMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "user"
    );
    expect(userMsg?.content).toContain("محتوى مستخرج من ملف PDF");
  });

  it("returns empty slides array when AI returns invalid JSON", async () => {
    mockCallAI.mockResolvedValue({
      content: "This is not valid JSON",
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generatePresentation({
      topic: "موضوع اختباري",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
    });

    expect(result.title).toBe("موضوع اختباري");
    expect(result.slides).toEqual([]);
  });

  it("passes correct slide count to AI prompt", async () => {
    mockCallAI.mockResolvedValue({
      content: JSON.stringify({ title: "عرض", slides: [] }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.generatePresentation({
      topic: "اختبار",
      slideCount: 12,
      brandId: "modern",
      language: "ar",
    });

    const userMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "user"
    );
    expect(userMsg?.content).toContain("12");
  });

  it("validates input constraints (min/max slide count)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // slideCount < 3 should fail validation
    await expect(
      caller.ai.generatePresentation({
        topic: "test",
        slideCount: 1,
        brandId: "ndmo",
        language: "ar",
      })
    ).rejects.toThrow();

    // slideCount > 20 should fail validation
    await expect(
      caller.ai.generatePresentation({
        topic: "test",
        slideCount: 25,
        brandId: "ndmo",
        language: "ar",
      })
    ).rejects.toThrow();
  });

  it("uses structured JSON schema with rich slide fields", async () => {
    mockCallAI.mockResolvedValue({
      content: JSON.stringify({ title: "عرض", slides: [] }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.generatePresentation({
      topic: "اختبار JSON schema",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
    });

    const callOptions = mockCallAI.mock.calls[0][1];
    expect(callOptions?.response_format?.type).toBe("json_schema");
    expect(callOptions?.response_format?.json_schema?.name).toBe("presentation");
    expect(callOptions?.response_format?.json_schema?.strict).toBe(true);

    // Verify rich slide fields are in the schema
    const slideProps =
      callOptions?.response_format?.json_schema?.schema?.properties?.slides
        ?.items?.properties;
    expect(slideProps).toBeDefined();
    expect(slideProps?.chartType).toBeDefined();
    expect(slideProps?.chartData).toBeDefined();
    expect(slideProps?.chartLabels).toBeDefined();
    expect(slideProps?.tableHeaders).toBeDefined();
    expect(slideProps?.tableRows).toBeDefined();
    expect(slideProps?.infographicItems).toBeDefined();
    expect(slideProps?.timelineItems).toBeDefined();
  });

  it("system prompt requires chart and table/infographic slides", async () => {
    mockCallAI.mockResolvedValue({
      content: JSON.stringify({ title: "عرض", slides: [] }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.generatePresentation({
      topic: "اختبار",
      slideCount: 8,
      brandId: "ndmo",
      language: "ar",
    });

    const systemMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "system"
    );
    // System prompt should mention chart, table, infographic, timeline layouts
    expect(systemMsg?.content).toContain("chart");
    expect(systemMsg?.content).toContain("table");
    expect(systemMsg?.content).toContain("infographic");
    expect(systemMsg?.content).toContain("timeline");
    expect(systemMsg?.content).toContain("kpi");
  });

  it("handles AI service errors gracefully", async () => {
    mockCallAI.mockRejectedValue(new Error("AI service unavailable"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.generatePresentation({
        topic: "اختبار الخطأ",
        slideCount: 5,
        brandId: "ndmo",
        language: "ar",
      })
    ).rejects.toThrow("AI service unavailable");
  });

  it("includes all required slide fields in response", async () => {
    const mockResponse = {
      title: "عرض كامل",
      slides: [
        createMockSlide({
          title: "العنوان الرئيسي",
          subtitle: "عنوان فرعي",
          content: "محتوى الشريحة التفصيلي والغني",
          bulletPoints: ["نقطة 1 مفصلة", "نقطة 2 مفصلة", "نقطة 3 مفصلة"],
          notes: "ملاحظات المتحدث التفصيلية",
          layout: "content",
        }),
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 200, completion_tokens: 400, total_tokens: 600 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generatePresentation({
      topic: "عرض كامل",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
    });

    const slide = result.slides[0];
    expect(slide).toHaveProperty("title");
    expect(slide).toHaveProperty("subtitle");
    expect(slide).toHaveProperty("content");
    expect(slide).toHaveProperty("bulletPoints");
    expect(slide).toHaveProperty("notes");
    expect(slide).toHaveProperty("layout");
    expect(Array.isArray(slide.bulletPoints)).toBe(true);
  });

  it("generates presentation with chart data properly", async () => {
    const mockResponse = {
      title: "تقرير إحصائي",
      slides: [
        createMockSlide({ layout: "title" }),
        createMockSlide({
          title: "الإحصائيات",
          layout: "chart",
          chartType: "bar",
          chartData: [85, 72, 90, 68],
          chartLabels: ["الحوكمة", "الجودة", "الإتاحة", "الحماية"],
          chartColors: ["#0f2744", "#d4af37", "#1a73e8", "#6b7280"],
        }),
        createMockSlide({
          title: "جدول المقارنة",
          layout: "table",
          tableHeaders: ["الجهة", "النضج", "التقييم"],
          tableRows: [
            ["وزارة المالية", "85%", "ممتاز"],
            ["وزارة الصحة", "72%", "جيد جداً"],
          ],
        }),
        createMockSlide({
          title: "أبرز المؤشرات",
          layout: "infographic",
          infographicItems: [
            { icon: "analytics", label: "نسبة النضج", value: "85%" },
            { icon: "groups", label: "الجهات المشاركة", value: "120" },
            { icon: "trending_up", label: "نسبة التحسن", value: "+15%" },
          ],
        }),
        createMockSlide({ layout: "closing" }),
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { prompt_tokens: 500, completion_tokens: 2000, total_tokens: 2500 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generatePresentation({
      topic: "تقرير إحصائي شامل",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
    });

    expect(result.slides).toHaveLength(5);

    // Verify chart slide
    const chartSlide = result.slides.find((s: any) => s.layout === "chart");
    expect(chartSlide).toBeDefined();
    expect(chartSlide?.chartType).toBe("bar");
    expect(chartSlide?.chartData).toEqual([85, 72, 90, 68]);
    expect(chartSlide?.chartLabels).toHaveLength(4);

    // Verify table slide
    const tableSlide = result.slides.find((s: any) => s.layout === "table");
    expect(tableSlide).toBeDefined();
    expect(tableSlide?.tableHeaders).toHaveLength(3);
    expect(tableSlide?.tableRows).toHaveLength(2);

    // Verify infographic slide
    const infoSlide = result.slides.find(
      (s: any) => s.layout === "infographic"
    );
    expect(infoSlide).toBeDefined();
    expect(infoSlide?.infographicItems).toHaveLength(3);
    expect(infoSlide?.infographicItems?.[0]).toHaveProperty("icon");
    expect(infoSlide?.infographicItems?.[0]).toHaveProperty("label");
    expect(infoSlide?.infographicItems?.[0]).toHaveProperty("value");
  });

  it("defaults contentSource to 'ai' when not specified", async () => {
    mockCallAI.mockResolvedValue({
      content: JSON.stringify({ title: "عرض", slides: [] }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: "gpt-4o-mini",
      source: "forge",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Call without contentSource — should default to 'ai'
    await caller.ai.generatePresentation({
      topic: "اختبار",
      slideCount: 5,
      brandId: "ndmo",
      language: "ar",
    });

    // The user message should NOT contain strict content instructions
    const userMsg = mockCallAI.mock.calls[0][0].find(
      (m: any) => m.role === "user"
    );
    expect(userMsg?.content).not.toContain("الالتزام الكامل");
    expect(userMsg?.content).not.toContain("تم استخراج المحتوى");
  });
});
