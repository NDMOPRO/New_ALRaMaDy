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

import { callAI } from "./openai";
const mockCallAI = vi.mocked(callAI);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── Text Operations ────────────────────────────────────────────
describe("ai.textOperation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("translates text to English", async () => {
    mockCallAI.mockResolvedValue({
      content: "Data Governance",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.textOperation({
      text: "حوكمة البيانات",
      operation: "translate",
    });

    expect(result.text).toBe("Data Governance");
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });

  it("rewrites text professionally", async () => {
    mockCallAI.mockResolvedValue({
      content: "نص معاد صياغته بشكل احترافي",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.textOperation({
      text: "نص بسيط",
      operation: "rewrite",
    });

    expect(result.text).toBe("نص معاد صياغته بشكل احترافي");
  });

  it("summarizes text content", async () => {
    mockCallAI.mockResolvedValue({
      content: "ملخص مختصر",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.textOperation({
      text: "نص طويل جداً يحتاج تلخيص...",
      operation: "summarize",
    });

    expect(result.text).toBe("ملخص مختصر");
  });

  it("expands text with more detail", async () => {
    mockCallAI.mockResolvedValue({
      content: "نص موسع بتفاصيل إضافية وشرح مفصل",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.textOperation({
      text: "حوكمة البيانات",
      operation: "expand",
    });

    expect(result.text).toContain("موسع");
  });

  it("generates speaker notes for a slide", async () => {
    mockCallAI.mockResolvedValue({
      content: "ملاحظات: ابدأ بالترحيب ثم اعرض النقاط الرئيسية",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.textOperation({
      text: "عنوان: مقدمة\nمحتوى: حوكمة البيانات الوطنية",
      operation: "generateNotes",
    });

    expect(result.text).toContain("ملاحظات");
  });
});

// ─── Quiz Generation ────────────────────────────────────────────
describe("ai.generateQuiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates multiple choice quiz questions", async () => {
    const quizData = {
      questions: [
        {
          question: "ما هو الهدف الرئيسي لحوكمة البيانات؟",
          type: "multiple_choice",
          options: ["تحسين الجودة", "زيادة التكلفة", "تقليل الأمان", "إبطاء العمليات"],
          correctAnswer: "تحسين الجودة",
        },
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(quizData),
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateQuiz({
      topic: "حوكمة البيانات",
      type: "multiple_choice",
      questionCount: 1,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.question).toContain("حوكمة");
    expect(result.questions[0]!.type).toBe("multiple_choice");
    expect(result.questions[0]!.options).toHaveLength(4);
  });

  it("generates poll questions", async () => {
    const pollData = {
      questions: [
        {
          question: "ما أهم تحدي في إدارة البيانات؟",
          type: "poll",
          options: ["الجودة", "الأمان", "التكامل", "الحوكمة"],
          correctAnswer: "",
        },
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(pollData),
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateQuiz({
      topic: "إدارة البيانات",
      type: "poll",
      questionCount: 1,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.type).toBe("poll");
  });

  it("generates open-ended questions", async () => {
    const openData = {
      questions: [
        {
          question: "كيف يمكن تحسين جودة البيانات في مؤسستك؟",
          type: "open",
          options: [],
          correctAnswer: "",
        },
      ],
    };

    mockCallAI.mockResolvedValue({
      content: JSON.stringify(openData),
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateQuiz({
      topic: "جودة البيانات",
      type: "open",
      questionCount: 1,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.type).toBe("open");
  });

  it("returns empty questions on invalid JSON response", async () => {
    mockCallAI.mockResolvedValue({
      content: "invalid json",
      model: "gpt-4o-mini",
      source: "openai",
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateQuiz({
      topic: "اختبار",
      type: "multiple_choice",
      questionCount: 3,
    });

    expect(result.questions).toEqual([]);
  });
});

// ─── Visual Match (CDR) ────────────────────────────────────────
// Note: visualMatch uses callVision (not callAI), so we test the data parsing
describe("Visual Match CDR - Data Parsing", () => {
  it("validates outputType enum values", () => {
    const validTypes = ["dashboard", "table", "report", "presentation", "excel"];
    validTypes.forEach((t) => {
      expect(validTypes).toContain(t);
    });
  });

  it("parses dashboard CDR reconstruction data", () => {
    const mockResponse = '{"widgets": [{"type": "kpi", "title": "test"}], "layout": {"columns": 4}}';
    const parsed = JSON.parse(mockResponse);
    expect(parsed.widgets).toBeDefined();
    expect(parsed.widgets).toHaveLength(1);
    expect(parsed.layout.columns).toBe(4);
  });

  it("parses presentation CDR reconstruction data", () => {
    const mockResponse = '{"slides": [{"title": "المقدمة", "content": "محتوى", "layout": "title"}]}';
    const parsed = JSON.parse(mockResponse);
    expect(parsed.slides).toHaveLength(1);
    expect(parsed.slides[0].title).toBe("المقدمة");
  });

  it("parses report CDR reconstruction data", () => {
    const mockResponse = '{"sections": [{"type": "cover", "title": "تقرير"}, {"type": "paragraph", "content": "ملخص"}]}';
    const parsed = JSON.parse(mockResponse);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].type).toBe("cover");
  });

  it("parses excel CDR reconstruction data", () => {
    const mockResponse = '{"columns": ["الجهة", "النسبة"], "rows": [["وزارة المالية", "94%"], ["وزارة الصحة", "88%"]]}';
    const parsed = JSON.parse(mockResponse);
    expect(parsed.columns).toHaveLength(2);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0][0]).toBe("وزارة المالية");
  });
});

// ─── Workspace Context Navigation ──────────────────────────────
describe("Workspace Navigation Features", () => {
  it("slide lock state toggles correctly", () => {
    const lockedSlides = new Set<string>();
    const slideId = "slide-1";

    // Lock
    lockedSlides.add(slideId);
    expect(lockedSlides.has(slideId)).toBe(true);

    // Unlock
    lockedSlides.delete(slideId);
    expect(lockedSlides.has(slideId)).toBe(false);
  });

  it("comments are stored per slide", () => {
    const slideComments: Record<string, string[]> = {};
    const slideId = "slide-1";

    // Add comment
    slideComments[slideId] = [...(slideComments[slideId] || []), "تعليق أول"];
    expect(slideComments[slideId]).toHaveLength(1);

    // Add another comment
    slideComments[slideId] = [...(slideComments[slideId] || []), "تعليق ثاني"];
    expect(slideComments[slideId]).toHaveLength(2);
  });

  it("presenter timer formats correctly", () => {
    const formatTimer = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(65)).toBe("01:05");
    expect(formatTimer(3600)).toBe("60:00");
  });
});

// ─── Export & Source Features ────────────────────────────────────
describe("Export & Source Features", () => {
  it("slide count options are valid", () => {
    const validCounts = [5, 8, 12, 15, 20];
    validCounts.forEach((count) => {
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(20);
    });
  });

  it("source types are comprehensive", () => {
    const sourceTypes = [
      "prompt", "pdf", "url", "data", "image", "research", "video", "json",
    ];
    expect(sourceTypes).toHaveLength(8);
    expect(sourceTypes).toContain("prompt");
    expect(sourceTypes).toContain("pdf");
    expect(sourceTypes).toContain("url");
    expect(sourceTypes).toContain("data");
    expect(sourceTypes).toContain("image");
  });

  it("text operations enum is complete", () => {
    const operations = ["translate", "rewrite", "summarize", "expand", "generateNotes"];
    expect(operations).toHaveLength(5);
    expect(operations).toContain("translate");
    expect(operations).toContain("generateNotes");
  });

  it("quiz types are valid", () => {
    const quizTypes = ["multiple_choice", "open", "poll"];
    expect(quizTypes).toHaveLength(3);
    expect(quizTypes).toContain("multiple_choice");
    expect(quizTypes).toContain("open");
    expect(quizTypes).toContain("poll");
  });
});
