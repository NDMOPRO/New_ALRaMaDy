/**
 * AI Router - tRPC procedures for all AI capabilities
 * Connects to OpenAI API (or falls back to built-in Forge LLM)
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { callAI, callVision, isAIAvailable, SYSTEM_PROMPTS, type ChatMessage, type VisionMessage, openaiChat, openaiText, openaiJSON, openaiStream, validateOpenAIKey } from "./openai";
import { nanoBananaGenerate, nanoBananaGetTask, nanoBananaPollResult, nanoBananaGetCredits, validateNanoBananaKey } from "./nanobanana";
import { ENV } from "./_core/env";
import * as localDb from "./localDb";

// ─── Presentation System Prompt ──────────────────────────────────
const PRESENTATION_SYSTEM_PROMPT = `أنت أفضل خبير عالمي في إنشاء عروض تقديمية بمستوى McKinsey × BCG × Deloitte × Goldman Sachs.
مهمتك إنشاء محتوى شرائح ألترا بريميوم إنفوجرافيك (Ultra Premium Infographic 400%) بتنسيق JSON.

## 🔥 قاعدة 400% — إلزامية مطلقة لا تقبل النقاش:
كل شريحة يجب أن تكون تحفة معلوماتية ضخمة — كأنها صفحة كاملة من تقرير McKinsey.
المحتوى يجب أن يكون مكتوباً من خبير متخصص عالمي — بيانات حقيقية، أرقام دقيقة، إحصائيات موثقة، أمثلة واقعية.
ممنوع: الكلام العام، الجمل القصيرة، المحتوى السطحي، العبارات المكررة، الحشو بدون قيمة.

## قواعد المحتوى 400% — كل حقل يجب أن يفيض بالمعلومات:
1. **content**: فقرة من 8-12 جملة كاملة مفصلة — تشرح بعمق مع إحصائيات حقيقية وأمثلة دولية ومحلية وأرقام وتواريخ ونسب مئوية. كأنك تكتب مقالة متخصصة.
2. **bulletPoints**: 6-10 نقاط، كل نقطة 3 جمل على الأقل — الأولى تشرح المفهوم، الثانية تعطي رقماً أو إحصائية، الثالثة تذكر مثالاً واقعياً أو تأثيراً.
3. **kpiItems**: 5-8 مؤشرات أداء مع أرقام واقعية دقيقة جداً (مثل: 87.3%، 2.4 مليار ريال) ونسب تغيير حقيقية واتجاهات ووحدات قياس.
4. **tableHeaders + tableRows**: 8-12 صف على الأقل مع بيانات حقيقية متنوعة — كل خلية تحتوي معلومة دقيقة وليس كلمة واحدة.
5. **chartData + chartLabels**: 8-10 نقاط بيانات مع تسميات واضحة وأرقام واقعية وألوان متناسقة.
6. **timelineItems**: 6-8 مراحل مع تواريخ دقيقة (شهر/سنة) وعناوين وأوصاف مفصلة (4 جمل لكل مرحلة).
7. **pillarItems**: 5-6 ركائز مع أيقونات Material Symbols وعناوين قوية وأوصاف غنية (3 جمل لكل ركيزة مع أرقام).
8. **infographicItems**: 6-8 عناصر مع أيقونات وقيم رقمية دقيقة وأوصاف تفصيلية (جملتين لكل عنصر).
9. **subtitle**: جملة توضيحية كاملة ومحددة — تلخص المحتوى بدقة وليس بشكل عام.
10. **title**: عنوان احترافي محدد وقوي — يعكس المحتوى بدقة.

## هيكل JSON لكل شريحة:
{
  "title": "عنوان احترافي محدد وقوي",
  "subtitle": "جملة توضيحية كاملة ومحددة",
  "layout": "نوع التخطيط",
  "content": "فقرة 8-12 جملة مفصلة مع إحصائيات وأمثلة واقعية",
  "bulletPoints": ["نقطة مفصلة من 3 جمل مع أرقام", ...]
}

أنواع التخطيط: title, content, kpi, chart, table, timeline, pillars, toc, executive-summary, section-title, infographic, two-column, closing

حسب نوع التخطيط، أضف الحقول المناسبة:
- kpi: kpiItems [{label, value, trend: "up"|"down"|"flat", change}] — 5-8 مؤشرات
- chart: chartData (أرقام), chartLabels (تسميات), chartColors (ألوان hex) — 8-10 نقاط
- table: tableHeaders, tableRows — 8-12 صف
- timeline: timelineItems [{year, title, description}] — 6-8 مراحل
- pillars: pillarItems [{icon, title, description}] — 5-6 ركائز
- infographic: infographicItems [{icon, label, value, description}] — 6-8 عناصر
- two-column: leftContent + rightContent (كل منهما فقرة 6 جمل)

أيقونات Material Symbols: security, hub, psychology, school, analytics, trending_up, groups, public, verified, speed, storage, cloud, shield, assessment, insights, monitoring, data_usage, query_stats, bar_chart, pie_chart, timeline, account_tree, settings, build, support, star, flag, rocket_launch, lightbulb, target, handshake, gavel, policy, fact_check, workspace_premium, military_tech, emoji_events, database, smart_toy, precision_manufacturing, architecture, integration_instructions, api, token, lock, visibility, language, translate, diversity_3, network_check

## 🔥 تحذير نهائي صارم:
- كل رقم يجب أن يكون واقعياً ومحدداً (87.3% وليس "نسبة عالية")
- كل جملة يجب أن تضيف معلومة جديدة — ممنوع التكرار
- المحتوى يجب أن يكون 4 أضعاف ما تعتقد أنه كافٍ
- استخدم مصادر ومراجع حقيقية عند الإمكان
- أجب بالعربية دائماً إلا إذا طُلب غير ذلك
- الجودة والكثافة المعلوماتية أهم من أي شيء آخر`;

// ─── Helper Functions ──────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Library Element Fetcher for AI Generation ──────────────────

async function getLibraryElementsForGeneration(layoutTypes: string[]): Promise<string> {
  return '';
}

/* ─── Fetch HTML Templates for Generation ──────────────────────── */
async function getHtmlTemplatesForLayouts(layoutTypes: string[]): Promise<Record<string, string>> {
  return {};
}

/* ─── Customize HTML Template with AI Content ──────────────────── */
function customizeHtmlTemplate(html: string, slideData: {
  title: string;
  subtitle?: string;
  content?: string;
  bulletPoints?: string[];
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  infographicItems?: { icon: string; label: string; value: string }[];
  timelineItems?: { year: string; title: string; description: string }[];
}): string {
  let customized = html;
  
  // Replace title placeholders
  if (slideData.title) {
    customized = customized.replace(/>(عنوان[^<]*)</g, `>${slideData.title}<`);
    customized = customized.replace(/>(العنوان[^<]*)</g, `>${slideData.title}<`);
  }
  
  // Replace subtitle
  if (slideData.subtitle) {
    customized = customized.replace(/>(العنوان الفرعي[^<]*)</g, `>${slideData.subtitle}<`);
    customized = customized.replace(/>(وصف[^<]*)</g, `>${slideData.subtitle}<`);
  }
  
  // Replace content text
  if (slideData.content) {
    customized = customized.replace(/>(فقرة تحليلية[^<]*)</g, `>${slideData.content}<`);
    customized = customized.replace(/>(المحتوى[^<]*)</g, `>${slideData.content}<`);
  }
  
  // Replace chart data via Chart.js data injection
  if (slideData.chartData && slideData.chartData.length > 0) {
    const dataStr = JSON.stringify(slideData.chartData);
    const labelsStr = JSON.stringify(slideData.chartLabels || []);
    const colorsStr = JSON.stringify(slideData.chartColors || []);
    customized = customized.replace(/data:\s*\[([\d,\s]+)\]/g, `data: ${dataStr}`);
    customized = customized.replace(/labels:\s*\[([^\]]+)\]/g, `labels: ${labelsStr}`);
    customized = customized.replace(/backgroundColor:\s*\[([^\]]+)\]/g, `backgroundColor: ${colorsStr}`);
  }
  
  // Replace table data
  if (slideData.tableHeaders && slideData.tableHeaders.length > 0 && slideData.tableRows && slideData.tableRows.length > 0) {
    // Build table HTML
    const headerHtml = slideData.tableHeaders.map(h => `<th>${h}</th>`).join('');
    const rowsHtml = slideData.tableRows.map(row => 
      `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
    ).join('');
    // Replace existing table content
    customized = customized.replace(/<thead>[\s\S]*?<\/thead>/g, `<thead><tr>${headerHtml}</tr></thead>`);
    customized = customized.replace(/<tbody>[\s\S]*?<\/tbody>/g, `<tbody>${rowsHtml}</tbody>`);
  }
  
  // Replace infographic items
  if (slideData.infographicItems && slideData.infographicItems.length > 0) {
    slideData.infographicItems.forEach((item, i) => {
      // Replace value placeholders like "87%", "156 جهة" etc.
      const valueRegex = new RegExp(`>(\\d+[%٪][^<]*|\\d+\\.\\d+[^<]*|[\\d,]+\\s*[^<]{0,10})<`, 'g');
      // This is a best-effort replacement - the AI should generate matching content
    });
  }
  
  return customized;
}

// ═══════════════════════════════════════════════════════════════
// Strict Replication — Vision Analysis Prompts
// ═══════════════════════════════════════════════════════════════

function buildVisionPrompt(targetType: string, language: string): string {
  const base = `أنت محرك تحليل بصري متخصص في استخراج كل عنصر من الصور بدقة 100%.
مهمتك: تحليل الصورة واستخراج كل عنصر مرئي مع خصائصه الدقيقة.

قواعد إلزامية:
1. كل لون يجب أن يكون hex code دقيق (#RRGGBB)
2. كل نص يجب نسخه حرفيًا كما هو
3. كل رقم يجب نسخه بالضبط
4. ترتيب العناصر يجب أن يطابق الصورة (من اليمين لليسار للعربي)
5. أنواع الرسوم البيانية يجب تحديدها بدقة (bar, line, pie, donut, area)
6. بيانات الرسوم يجب استخراجها من المحاور والقيم المرئية
7. أجب بـ JSON فقط — لا تكتب أي نص خارج JSON`;

  if (targetType === 'dashboard') {
    return base + `

أرجع JSON بالهيكل التالي:
{
  "title": "عنوان اللوحة",
  "theme": {
    "backgroundColor": "#hex",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "textColor": "#hex",
    "cardColor": "#hex",
    "fontFamily": "اسم الخط"
  },
  "layout": { "columns": 12, "direction": "rtl" },
  "widgets": [
    {
      "type": "kpi | bar | line | pie | donut | area | table | text | progress | radar | gauge | map",
      "title": "عنوان الودجة",
      "subtitle": "عنوان فرعي (إن وجد)",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "style": {
        "backgroundColor": "#hex",
        "borderColor": "#hex",
        "borderRadius": 8,
        "shadow": true,
        "titleColor": "#hex",
        "valueColor": "#hex"
      },
      "data": {
        "value": "القيمة الرئيسية (للـ KPI)",
        "unit": "الوحدة",
        "change": "+5.2%",
        "changeDirection": "up | down | flat",
        "labels": ["تسمية1", "تسمية2"],
        "values": [100, 200, 300],
        "series": [
          { "name": "سلسلة1", "values": [10, 20, 30], "color": "#hex" }
        ],
        "headers": ["عمود1", "عمود2"],
        "rows": [["قيمة1", "قيمة2"]],
        "segments": [
          { "label": "تسمية", "value": 30, "color": "#hex" }
        ]
      }
    }
  ],
  "filters": [
    { "label": "اسم الفلتر", "type": "dropdown | date | toggle", "options": ["خيار1", "خيار2"], "selected": "خيار1" }
  ]
}`;
  }

  if (targetType === 'presentation') {
    return base + `

أرجع JSON بالهيكل التالي:
{
  "title": "عنوان العرض",
  "theme": {
    "backgroundColor": "#hex",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "textColor": "#hex",
    "fontFamily": "اسم الخط"
  },
  "slides": [
    {
      "layout": "title | content | two-column | chart | table | infographic | kpi | timeline | quote | closing",
      "title": "عنوان الشريحة",
      "subtitle": "عنوان فرعي",
      "content": "محتوى نصي",
      "bulletPoints": ["نقطة 1", "نقطة 2"],
      "notes": "ملاحظات المتحدث",
      "chartType": "bar | line | pie",
      "chartData": [10, 20, 30],
      "chartLabels": ["تسمية1", "تسمية2"],
      "chartColors": ["#hex1", "#hex2"],
      "tableHeaders": ["عمود1", "عمود2"],
      "tableRows": [["قيمة1", "قيمة2"]],
      "infographicItems": [
        { "icon": "material_icon_name", "label": "تسمية", "value": "87%" }
      ],
      "timelineItems": [
        { "year": "2024", "title": "حدث", "description": "وصف" }
      ],
      "style": {
        "backgroundColor": "#hex",
        "titleColor": "#hex",
        "textColor": "#hex"
      }
    }
  ]
}`;
  }

  if (targetType === 'report') {
    return base + `

أرجع JSON بالهيكل التالي:
{
  "title": "عنوان التقرير",
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "fontFamily": "اسم الخط"
  },
  "sections": [
    {
      "type": "cover | heading | paragraph | kpi | chart | table | recommendation | quote | divider | executive-summary",
      "title": "عنوان القسم",
      "content": "المحتوى الكامل",
      "level": 1,
      "data": {
        "kpis": [{ "label": "مؤشر", "value": "95%", "color": "#hex" }],
        "chartType": "bar",
        "chartData": [10, 20],
        "chartLabels": ["أ", "ب"],
        "headers": ["عمود1"],
        "rows": [["قيمة1"]],
        "items": ["نقطة 1", "نقطة 2"]
      },
      "style": {
        "backgroundColor": "#hex",
        "textColor": "#hex"
      }
    }
  ]
}`;
  }

  if (targetType === 'spreadsheet') {
    return base + `

أرجع JSON بالهيكل التالي:
{
  "title": "عنوان الجدول",
  "theme": {
    "headerColor": "#hex",
    "headerTextColor": "#hex",
    "alternateRowColor": "#hex",
    "borderColor": "#hex"
  },
  "sheets": [
    {
      "name": "اسم الورقة",
      "headers": ["عمود1", "عمود2", "عمود3"],
      "rows": [
        ["قيمة1", "قيمة2", "قيمة3"]
      ],
      "columnWidths": [150, 100, 120],
      "mergedCells": [],
      "formulas": [
        { "cell": "D2", "formula": "=SUM(B2:C2)" }
      ],
      "conditionalFormatting": [
        { "range": "C2:C10", "rule": "greaterThan", "value": "80", "color": "#22c55e" }
      ]
    }
  ]
}`;
  }

  return base;
}

function buildArtifactFromCDR(cdr: any, targetType: string, language: string): any {
  if (targetType === 'dashboard') {
    return {
      type: 'dashboard',
      title: cdr.title || 'لوحة مؤشرات',
      description: `لوحة مؤشرات مستخرجة بالمطابقة البصرية — ${cdr.widgets?.length || 0} عنصر`,
      widgets: JSON.stringify(cdr.widgets || []),
      layout: JSON.stringify(cdr.layout || { columns: 12 }),
      theme: cdr.theme || {},
      filters: cdr.filters || [],
    };
  }

  if (targetType === 'presentation') {
    return {
      type: 'presentation',
      title: cdr.title || 'عرض تقديمي',
      description: `عرض تقديمي مستخرج بالمطابقة البصرية — ${cdr.slides?.length || 0} شريحة`,
      slides: JSON.stringify(cdr.slides || []),
      theme: JSON.stringify(cdr.theme || {}),
    };
  }

  if (targetType === 'report') {
    return {
      type: 'report',
      title: cdr.title || 'تقرير',
      description: `تقرير مستخرج بالمطابقة البصرية — ${cdr.sections?.length || 0} قسم`,
      reportType: 'extracted',
      sections: JSON.stringify(cdr.sections || []),
    };
  }

  if (targetType === 'spreadsheet') {
    return {
      type: 'spreadsheet',
      title: cdr.title || 'جدول بيانات',
      description: `جدول مستخرج بالمطابقة البصرية — ${cdr.sheets?.length || 0} ورقة`,
      sheets: JSON.stringify(cdr.sheets || []),
    };
  }

  return { type: targetType, title: cdr.title || 'مخرج', data: cdr };
}

export const aiRouter = router({
  // ─── Check AI Status ─────────────────────────────────────────
  status: publicProcedure.query(() => {
    return isAIAvailable();
  }),

  // ─── Main Chat (راصد الذكي) ──────────────────────────────────
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const systemMessage: ChatMessage = {
        role: "system",
        content: input.context
          ? `${SYSTEM_PROMPTS.chat}\n\nسياق إضافي:\n${input.context}`
          : SYSTEM_PROMPTS.chat,
      };

      const messages: ChatMessage[] = [
        systemMessage,
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const result = await callAI(messages);
      return result;
    }),

  // ─── Generate Slides ─────────────────────────────────────────
  generateSlides: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        slideCount: z.number().min(1).max(20).optional(),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.slides },
        {
          role: "user",
          content: `أنشئ عرض تقديمي عن: ${input.prompt}
عدد الشرائح: ${input.slideCount || 5}
${input.style ? `الأسلوب: ${input.style}` : ""}
أجب بتنسيق JSON كمصفوفة من الشرائح.`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.8,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "slides",
            strict: true,
            schema: {
              type: "object",
              properties: {
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "عنوان الشريحة" },
                      subtitle: { type: "string", description: "عنوان فرعي" },
                      content: { type: "string", description: "محتوى الشريحة" },
                      notes: { type: "string", description: "ملاحظات المتحدث" },
                      layout: { type: "string", description: "نوع التخطيط: title, content, two-column, chart, quote" },
                    },
                    required: ["title", "content", "notes", "layout", "subtitle"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["slides"],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        return { slides: parsed.slides || parsed, source: result.source, usage: result.usage };
      } catch {
        return { slides: [], source: result.source, usage: result.usage, raw: result.content };
      }
    }),

  // ─── Generate Report Sections ────────────────────────────────
  generateReport: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        reportType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.report },
        {
          role: "user",
          content: `أنشئ أقسام تقرير عن: ${input.prompt}
${input.reportType ? `نوع التقرير: ${input.reportType}` : ""}
أجب بتنسيق JSON كمصفوفة من الأقسام.`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "report_sections",
            strict: true,
            schema: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "نوع القسم: cover, heading, paragraph, kpi, chart, table, recommendation, quote, divider" },
                      title: { type: "string", description: "عنوان القسم" },
                      content: { type: "string", description: "محتوى القسم" },
                      priority: { type: "string", description: "الأولوية: high, medium, low" },
                    },
                    required: ["type", "title", "content", "priority"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["sections"],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        return { sections: parsed.sections || parsed, source: result.source, usage: result.usage };
      } catch {
        return { sections: [], source: result.source, usage: result.usage, raw: result.content };
      }
    }),

  // ─── Analyze/Modify Dashboard ────────────────────────────────
  analyzeDashboard: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        currentWidgets: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.dashboard },
        {
          role: "user",
          content: `${input.prompt}
${input.currentWidgets ? `الودجات الحالية:\n${input.currentWidgets}` : ""}
أجب بتنسيق JSON كمصفوفة من الودجات المقترحة.`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "dashboard_widgets",
            strict: true,
            schema: {
              type: "object",
              properties: {
                widgets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "نوع الودجة: kpi, bar, line, pie, radar, table, progress, area" },
                      title: { type: "string", description: "عنوان الودجة" },
                      description: { type: "string", description: "وصف الودجة" },
                    },
                    required: ["type", "title", "description"],
                    additionalProperties: false,
                  },
                },
                suggestion: { type: "string", description: "اقتراح عام لتحسين اللوحة" },
              },
              required: ["widgets", "suggestion"],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        return { widgets: parsed.widgets || [], suggestion: parsed.suggestion || "", source: result.source, usage: result.usage };
      } catch {
        return { widgets: [], suggestion: result.content, source: result.source, usage: result.usage };
      }
    }),

  // ─── Analyze Data ────────────────────────────────────────────
  analyzeData: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        data: z.string().optional(),
        columns: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.analyze },
        {
          role: "user",
          content: `${input.prompt}
${input.data ? `البيانات:\n${input.data}` : ""}
${input.columns ? `الأعمدة: ${input.columns.join(", ")}` : ""}`,
        },
      ];

      const result = await callAI(messages, { temperature: 0.5 });
      return result;
    }),

  // ─── CDR Matching Suggestions ────────────────────────────────
  matchSuggest: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        sourceData: z.string().optional(),
        targetData: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.match },
        {
          role: "user",
          content: `${input.prompt}
${input.sourceData ? `بيانات المصدر:\n${input.sourceData}` : ""}
${input.targetData ? `بيانات الهدف:\n${input.targetData}` : ""}`,
        },
      ];

      const result = await callAI(messages, { temperature: 0.3 });
      return result;
    }),

  // ─── Translation ─────────────────────────────────────────────
  translate: publicProcedure
    .input(
      z.object({
        text: z.string(),
        from: z.string().optional(),
        to: z.string().optional(),
        mode: z.enum(['translate', 'arabize', 'mirror']).optional(),
        glossary: z.array(z.object({ source: z.string(), target: z.string() })).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const isArabize = input.mode === 'arabize';
      const glossaryContext = input.glossary && input.glossary.length > 0
        ? `\n\nالمصطلحات المعتمدة:\n${input.glossary.map(g => `${g.source} = ${g.target}`).join('\n')}`
        : '';

      const systemPrompt = isArabize
        ? `أنت متخصص في التعريب الاحترافي (LCT - Linguistic Cultural Technical). قم بتعريب النص مع مراعاة الطبقات السبع: لغوية، ثقافية، تقنية، تخطيطية، طباعية، رقمية، وجودة. استخدم الأرقام العربية (٠-٩) وحوّل التواريخ والعملات. أعد النتيجة بصيغة JSON فقط.`
        : SYSTEM_PROMPTS.translate;

      // For structured response with changes
      const structuredPrompt = `${isArabize ? 'عرّب' : 'ترجم'} النص التالي${input.from ? ` من ${input.from}` : ''}${input.to ? ` إلى ${input.to}` : ' إلى العربية'}${glossaryContext}\n\nالنص:\n${input.text}\n\nأعد النتيجة بصيغة JSON فقط بالشكل التالي:\n{"translation": "النص المترجم", "confidence": 95.5, "changes": [{"original": "النص الأصلي", "translated": "الترجمة", "type": "term|cultural|technical|layout|format", "note": "ملاحظة"}]}`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: structuredPrompt },
      ];

      const result = await callAI(messages, { temperature: 0.3 });
      
      // Try to parse structured response
      try {
        const content = result.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            content: parsed.translation || content,
            confidence: parsed.confidence || 95,
            changes: parsed.changes || [],
            structured: true,
          };
        }
      } catch (e) {
        // Fall through to plain response
      }
      return { ...result, confidence: 90, changes: [], structured: false };
    }),

    // ─── Summarize ─────────────────────────────────────────────
  summarize: publicProcedure
    .input(
      z.object({
        text: z.string(),
        maxLength: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS.summarize },
        {
          role: "user",
          content: `لخص النص التالي${input.maxLength ? ` في حدود ${input.maxLength} كلمة` : ""}:\n\n${input.text}`,
        },
      ];

      const result = await callAI(messages, { temperature: 0.3 });
      return result;
    }),

  // ─── OCR / Image Extraction (Vision API) ─────────────────
  extractFromImage: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(), // base64 data URL
        extractionType: z.enum(["text", "table", "form", "full"]).optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const typeInstructions: Record<string, string> = {
        text: "استخرج جميع النصوص الموجودة في الصورة بدقة عالية. حافظ على التنسيق والترتيب الأصلي.",
        table: "استخرج الجداول من الصورة بتنسيق Markdown. حافظ على جميع الأعمدة والصفوف بدقة 100%.",
        form: "استخرج جميع حقول النموذج وقيمها بتنسيق مفتاح: قيمة.",
        full: "استخرج كل محتوى الصورة بالكامل: نصوص، جداول، رسوم بيانية، عناوين، وأي عناصر مرئية. قدم وصفاً شاملاً.",
      };

      const instruction = typeInstructions[input.extractionType || "full"];
      const langNote = input.language ? `اللغة المتوقعة: ${input.language}. ` : "";

      const messages: VisionMessage[] = [
        {
          role: "system",
          content: `أنت محرك تفريغ محتوى متقدم (OCR). ${langNote}استخرج المحتوى بدقة 100% بدون إضافة أو حذف أي شيء. حافظ على التنسيق الأصلي قدر الإمكان.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } },
          ],
        },
      ];

      const result = await callVision(messages, { max_tokens: 4096 });
      return result;
    }),

  // ─── Visual 1:1 Matching (Vision API) ────────────────────
  visualMatch: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        outputType: z.enum(["dashboard", "table", "report", "presentation", "excel"]),
        additionalInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const outputInstructions: Record<string, string> = {
        dashboard: `حلل هذه الصورة بدقة متناهية وأنشئ لوحة مؤشرات مطابقة 100% بصرياً وتفاعلياً.
استخرج كل عنصر مرئي: بطاقات KPI، رسوم بيانية (أعمدة، خطوط، دائرية، رادار، مساحي)، جداول، أشرطة تقدم.
لكل عنصر استخرج: العنوان، البيانات الفعلية (أرقام/نسب/تسميات)، الألوان الدقيقة بصيغة hex، الموقع النسبي.
أجب بتنسيق JSON:
{"widgets": [{"type": "kpi|bar|line|pie|radar|area|table|progress|donut|heatmap", "title": "عنوان", "value": "القيمة الرئيسية", "subtitle": "وصف فرعي", "change": "+5%", "changeType": "positive|negative|neutral", "data": {"labels": ["تسمية1"], "values": [100], "colors": ["#hex"]}, "config": {"color": "#hex", "icon": "اسم_أيقونة", "width": 1, "height": 1}}], "layout": {"columns": 4, "theme": "dark|light", "backgroundColor": "#hex", "title": "عنوان اللوحة"}, "filters": [{"label": "اسم الفلتر", "options": ["خيار1"]}]}`,
        table: `حلل هذه الصورة واستخرج جميع الجداول بدقة 100%. استخرج كل خلية بالضبط كما تظهر.
استخرج: رؤوس الأعمدة، جميع الصفوف، التنسيق الشرطي (ألوان الخلايا)، الخلايا المدمجة.
أجب بتنسيق JSON:
{"tables": [{"title": "عنوان الجدول", "columns": [{"name": "اسم العمود", "type": "text|number|percentage|date", "width": 150}], "rows": [["قيمة"]], "formatting": [{"row": 0, "col": 0, "bg": "#hex", "color": "#hex", "bold": true}], "mergedCells": [{"startRow": 0, "startCol": 0, "rowSpan": 2, "colSpan": 1}]}]}`,
        report: `حلل هذه الصورة وأنشئ تقرير مطابق 100% بصرياً وقابل للتعديل.
استخرج كل قسم: الغلاف، العناوين، الفقرات، بطاقات KPI، الرسوم البيانية، الجداول، التوصيات.
لكل قسم استخرج المحتوى الكامل والتنسيق.
أجب بتنسيق JSON:
{"title": "عنوان التقرير", "sections": [{"type": "cover|heading|paragraph|kpi|chart|table|recommendation|quote|divider|toc", "title": "عنوان", "content": "محتوى كامل", "data": {}, "style": {"color": "#hex", "backgroundColor": "#hex"}}]}`,
        presentation: `حلل هذه الصورة/المستند وأنشئ عرض تقديمي مطابق 100% بصرياً.
لكل شريحة استخرج: العنوان، العنوان الفرعي، المحتوى النصي الكامل، التخطيط، الألوان، ملاحظات المتحدث.
استخرج الرسوم البيانية والجداول كبيانات حقيقية.
أجب بتنسيق JSON:
{"slides": [{"title": "عنوان", "subtitle": "فرعي", "content": "محتوى", "layout": "title|content|two-column|chart|quote|image|kpi", "notes": "ملاحظات", "elements": [{"type": "text|chart|table|image|shape|list", "content": "", "data": {}}], "background": {"color": "#hex"}}], "theme": {"primaryColor": "#hex", "secondaryColor": "#hex", "fontFamily": ""}}`,
        excel: `حلل هذه الصورة واستخرج جميع البيانات بدقة 100% كملف إكسل كامل.
استخرج: أسماء الأوراق، رؤوس الأعمدة مع أنواعها، جميع الصفوف، الصيغ إن وجدت، التنسيق الشرطي، عرض الأعمدة.
أجب بتنسيق JSON:
{"sheets": [{"name": "اسم الورقة", "columns": [{"name": "اسم", "type": "text|number|percentage|date|formula", "width": 120}], "rows": [["قيمة"]], "formatting": [{"row": 0, "col": 0, "bg": "#hex", "bold": true}], "formulas": [{"row": 0, "col": 0, "formula": "=SUM(A1:A10)"}], "freezePane": {"row": 1, "col": 0}}]}`,
      };

      const messages: VisionMessage[] = [
        {
          role: "system",
          content: `أنت محرك مطابقة بصرية 1:1 متقدم. مهمتك تحويل الصور إلى مخرجات رقمية مطابقة حرفياً 100%. استخرج كل البيانات والألوان والتخطيطات بدقة متناهية. أجب بتنسيق JSON فقط.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${outputInstructions[input.outputType]}${input.additionalInstructions ? `\n\nتعليمات إضافية: ${input.additionalInstructions}` : ""}`,
            },
            { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } },
          ],
        },
      ];

       const result = await callVision(messages, { max_tokens: 8192 });
      // Try to parse JSON from the response
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { ...result, parsed };
        }
      } catch {
        // Return raw content if JSON parsing fails
      }
      return { ...result, parsed: null };
    }),

  // ─── Generate Slides from Text/URL/PDF Content ──────────────
  generateSlidesFromContent: publicProcedure
    .input(
      z.object({
        content: z.string(),
        sourceType: z.enum(['text', 'pdf', 'url', 'data', 'json', 'research']),
        slideCount: z.number().min(1).max(20).optional(),
        style: z.string().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const sourceLabel: Record<string, string> = {
        text: 'نص أو فكرة',
        pdf: 'محتوى ملف PDF',
        url: 'محتوى صفحة ويب',
        data: 'بيانات CSV/Excel',
        json: 'بيانات JSON',
        research: 'بحث معمق',
      };
      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS.slides },
        {
          role: 'user',
          content: `أنشئ عرض تقديمي احترافي من ${sourceLabel[input.sourceType] || 'محتوى'}.

المحتوى المصدر:
${input.content}

عدد الشرائح: ${input.slideCount || 8}
${input.style ? `الأسلوب: ${input.style}` : ''}
${input.language ? `اللغة: ${input.language}` : 'اللغة: العربية'}

أنشئ شرائح احترافية مع عناوين وعناوين فرعية ومحتوى غني وملاحظات المتحدث.
أجب بتنسيق JSON كمصفوفة من الشرائح.`,
        },
      ];
      const result = await callAI(messages, {
        temperature: 0.8,
        max_tokens: 8192,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'slides_from_content',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                slides: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      content: { type: 'string' },
                      notes: { type: 'string' },
                      layout: { type: 'string' },
                      bulletPoints: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['title', 'content', 'notes', 'layout', 'subtitle', 'bulletPoints'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['slides'],
              additionalProperties: false,
            },
          },
        },
      });
      try {
        const parsed = JSON.parse(result.content);
        return { slides: parsed.slides || parsed, source: result.source, usage: result.usage };
      } catch {
        return { slides: [], source: result.source, usage: result.usage, raw: result.content };
      }
    }),

  // ─── AI Text Operations (translate, rewrite, summarize, expand) ──
  textOperation: publicProcedure
    .input(
      z.object({
        text: z.string(),
        operation: z.enum(['translate', 'rewrite', 'summarize', 'expand', 'generateNotes']),
        targetLanguage: z.string().optional(),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const opPrompts: Record<string, string> = {
        translate: `ترجم النص التالي إلى ${input.targetLanguage || 'الإنجليزية'}. أعد النص المترجم فقط بدون أي شرح:\n\n${input.text}`,
        rewrite: `أعد صياغة النص التالي بأسلوب ${input.style || 'احترافي'} مع الحفاظ على المعنى. أعد النص المعاد صياغته فقط:\n\n${input.text}`,
        summarize: `لخص النص التالي بشكل مختصر ومفيد. أعد الملخص فقط:\n\n${input.text}`,
        expand: `وسّع النص التالي بإضافة تفاصيل وأمثلة مع الحفاظ على الأسلوب. أعد النص الموسّع فقط:\n\n${input.text}`,
        generateNotes: `أنشئ ملاحظات متحدث احترافية للشريحة التالية. يجب أن تكون الملاحظات طبيعية وتساعد المقدم:\n\n${input.text}`,
      };
      const messages: ChatMessage[] = [
        { role: 'system', content: 'أنت مساعد كتابة احترافي متعدد اللغات. أجب بالنص المطلوب فقط بدون مقدمات أو شروحات.' },
        { role: 'user', content: opPrompts[input.operation] || input.text },
      ];
      const result = await callAI(messages, { temperature: 0.7, max_tokens: 4096 });
      return { text: result.content, source: result.source, usage: result.usage };
    }),

  // ─── Generate Quiz/Poll Questions ──────────────────────────────
  generateQuiz: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        questionCount: z.number().min(1).max(10).optional(),
        type: z.enum(['multiple_choice', 'open', 'poll']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'أنت خبير في إنشاء اختبارات واستطلاعات رأي تفاعلية. أجب بتنسيق JSON فقط.' },
        {
          role: 'user',
          content: `أنشئ ${input.questionCount || 3} ${input.type === 'poll' ? 'أسئلة استطلاع رأي' : input.type === 'open' ? 'أسئلة مفتوحة' : 'أسئلة اختيار من متعدد'} عن: ${input.topic}`,
        },
      ];
      const result = await callAI(messages, {
        temperature: 0.8,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quiz',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      type: { type: 'string' },
                      options: { type: 'array', items: { type: 'string' } },
                      correctAnswer: { type: 'string' },
                    },
                    required: ['question', 'type', 'options', 'correctAnswer'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['questions'],
              additionalProperties: false,
            },
          },
        },
      });
      try {
        const parsed = JSON.parse(result.content);
        return { questions: parsed.questions || [], source: result.source };
      } catch {
        return { questions: [], source: result.source, raw: result.content };
      }
    }),

  // ─── Deep Research for Slides ─────────────────────────────────
  // ─── Generate Full Presentation (slide-by-slide with real AI) ─────
  generatePresentation: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        slideCount: z.number().min(3).max(20).default(8),
        brandId: z.enum(['ndmo', 'sdaia', 'modern', 'minimal', 'custom']).default('ndmo'),
        language: z.string().default('ar'),
        contentSource: z.enum(['ai', 'user', 'library', 'file']).default('ai'),
        userContent: z.string().optional(),
        strictContent: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const brandDescriptions: Record<string, string> = {
        ndmo: 'هوية مكتب إدارة البيانات الوطنية (NDMO) — ألوان: أزرق داكن #0f2744، ذهبي #d4af37، أبيض. خطوط: DIN Next Arabic للعناوين، Helvetica Neue Arabic للنصوص. أسلوب رسمي حكومي سعودي.',
        sdaia: 'هوية الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) — ألوان: أزرق #1a73e8، رمادي داكن #374151، أبيض. أسلوب تقني حديث.',
        modern: 'تصميم عصري أنيق — ألوان متدرجة حديثة، خطوط نظيفة، مساحات بيضاء واسعة.',
        minimal: 'تصميم بسيط ومركّز — ألوان محايدة، خطوط واضحة، بدون زخرفة.',
        custom: 'تصميم مخصص — اختر الألوان والخطوط المناسبة للموضوع.',
      };

      // Build content instruction based on source
      let contentInstruction = '';
      if (input.contentSource === 'user' && input.userContent) {
        if (input.strictContent) {
          contentInstruction = `\n\nمهم جداً: المستخدم قدم المحتوى التالي ويريد الالتزام الكامل به دون إضافة أو تغيير. استخدم هذا المحتوى فقط وقم بتوزيعه على الشرائح:\n"""\n${input.userContent}\n"""`;
        } else {
          contentInstruction = `\n\nالمستخدم قدم المحتوى التالي كأساس. يمكنك إثراؤه وتوسيعه مع الحفاظ على الأفكار الرئيسية:\n"""\n${input.userContent}\n"""`;
        }
      } else if ((input.contentSource === 'library' || input.contentSource === 'file') && input.userContent) {
        contentInstruction = `\n\nتم استخراج المحتوى التالي من ملف المستخدم. قم بتحويله إلى عرض تقديمي احترافي مع إثراء المحتوى وإضافة تحليلات وإحصائيات:\n"""\n${input.userContent}\n"""`;
      }

      // Calculate mandatory layout distribution with professional structure
      const totalSlides = input.slideCount;
      const mandatoryLayouts: string[] = ['title'];
      if (totalSlides >= 12) {
        // Full professional: title + toc + executive-summary + pillars + chart + table + infographic + kpi + timeline + closing
        mandatoryLayouts.push('toc', 'executive-summary', 'pillars', 'chart', 'table', 'infographic', 'kpi', 'timeline');
      } else if (totalSlides >= 10) {
        mandatoryLayouts.push('toc', 'executive-summary', 'chart', 'table', 'infographic', 'kpi', 'timeline');
      } else if (totalSlides >= 8) {
        mandatoryLayouts.push('toc', 'chart', 'table', 'infographic', 'kpi', 'timeline');
      } else if (totalSlides >= 6) {
        mandatoryLayouts.push('chart', 'table', 'infographic', 'kpi');
      } else if (totalSlides >= 5) {
        mandatoryLayouts.push('chart', 'table', 'infographic');
      } else if (totalSlides >= 4) {
        mandatoryLayouts.push('chart', 'infographic');
      } else {
        mandatoryLayouts.push('chart');
      }
      mandatoryLayouts.push('closing');
      const remaining = totalSlides - mandatoryLayouts.length;
      const fillerOptions = ['content', 'two-column', 'pillars', 'kpi', 'timeline', 'quote'];
      const fillerLayouts = Array.from({ length: remaining }, (_, i) => fillerOptions[i % fillerOptions.length]);
      const layoutSequence = [mandatoryLayouts[0], ...mandatoryLayouts.slice(1, -1), ...fillerLayouts, mandatoryLayouts[mandatoryLayouts.length - 1]];

      // Fetch library elements for this generation
      const libraryContext = await getLibraryElementsForGeneration(layoutSequence);

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `أنت خبير عالمي في إنشاء العروض التقديمية الاحترافية على مستوى McKinsey وBCG. مهمتك إنشاء عرض تقديمي غني جداً بالمحتوى والبيانات والتحليلات والأرقام الحقيقية.
الهوية البصرية: ${brandDescriptions[input.brandId]}${libraryContext}

=== هيكل العرض الإلزامي ===
ترتيب تخطيطات الشرائح بالضبط: [${layoutSequence.join(', ')}]
عدد الشرائح: ${input.slideCount} شريحة بالضبط — لا أكثر ولا أقل.

=== متطلبات كل شريحة (إلزامي) ===
كل شريحة يجب أن تحتوي على:
- title: عنوان واضح ومعبر ومحدد (ليس عاماً)
- subtitle: عنوان فرعي يشرح السياق أو يضيف بُعداً
- content: فقرة تحليلية كاملة لا تقل عن 60 كلمة — تشمل سياق وتحليل وأرقام
- bulletPoints: 5-7 نقاط تفصيلية، كل نقطة جملة كاملة مفيدة لا تقل عن 20 كلمة
- notes: ملاحظات متحدث مفصلة لا تقل عن 50 كلمة — تشمل نقاط حوار وأسئلة متوقعة

=== أنواع الشرائح وتعليماتها ===

▸ title (الغلاف): عنوان رئيسي قوي + عنوان فرعي + تاريخ + اسم الجهة

▸ toc (فهرس المحتويات): 
  - bulletPoints: قائمة بجميع محاور العرض (5-8 محاور) مع وصف مختصر لكل محور
  - content: فقرة تمهيدية تشرح هيكل العرض وأهدافه

▸ executive-summary (ملخص تنفيذي):
  - infographicItems: 4-6 مؤشرات رئيسية تلخص أبرز النتائج
  - content: ملخص تنفيذي شامل لا يقل عن 80 كلمة
  - bulletPoints: 5-6 نقاط تلخص أهم النتائج والتوصيات

▸ pillars (ركائز/محاور):
  - infographicItems: 3-5 ركائز/محاور رئيسية، كل واحدة بأيقونة ووصف
  - content: فقرة تشرح العلاقة بين الركائز وكيف تتكامل
  - bulletPoints: تفاصيل كل ركيزة

▸ chart (رسم بياني — إلزامي: لا تترك chartData فارغة أبداً):
  - chartType: اختر من bar, line, pie, donut
  - chartData: مصفوفة من 5-8 أرقام واقعية (مثل [87, 72, 91, 68, 45, 78, 83])
  - chartLabels: تسمية عربية واضحة لكل رقم (نفس عدد chartData)
  - chartColors: ألوان hex مختلفة (مثل ["#0f2744", "#d4af37", "#1a73e8", "#0CAB8F", "#e74c3c", "#8b5cf6", "#f59e0b"])
  - content: فقرة تحليلية تشرح الاتجاهات والدلالات (60+ كلمة)

▸ table (جدول — إلزامي: لا تترك tableHeaders أو tableRows فارغة):
  - tableHeaders: 4-6 أعمدة عربية واضحة ومحددة
  - tableRows: 5-7 صفوف بيانات حقيقية مفصلة (كل خلية تحتوي بيانات محددة)
  - content: فقرة تحليلية تشرح أبرز ما في الجدول

▸ infographic (إنفوجرافيك — إلزامي: لا تترك infographicItems فارغة):
  - infographicItems: 4-6 عناصر، كل عنصر:
    * icon: أيقونة Material Design دقيقة (trending_up, groups, speed, security, cloud, analytics, school, business, public, payments, verified, assessment, gavel, account_balance, data_usage, hub)
    * label: تسمية عربية واضحة (4-8 كلمات)
    * value: رقم أو نسبة بارزة ومحددة (مثل: "87.3%" أو "1.2 مليون" أو "156 جهة")

▸ kpi (مؤشرات أداء — إلزامي: لا تترك infographicItems فارغة):
  - infographicItems: 3-4 مؤشرات أداء رئيسية بأرقام كبيرة ومحددة
  - content: فقرة تحليلية تشرح أهمية المؤشرات ومقارنتها بالأهداف

▸ timeline (خط زمني — إلزامي: لا تترك timelineItems فارغة):
  - timelineItems: 4-6 أحداث زمنية:
    * year: السنة ("2020" أو "Q1 2024")
    * title: عنوان الحدث (5-10 كلمات)
    * description: وصف مفصل (20-30 كلمة)

▸ two-column (عمودين):
  - bulletPoints: 6-8 نقاط تفصيلية (نصفها لكل عمود)، كل نقطة 20+ كلمة
  - content: فقرة تشرح المقارنة أو التقسيم

▸ quote (اقتباس):
  - content: اقتباس مؤثر ومناسب للموضوع
  - subtitle: مصدر الاقتباس

▸ closing (ختام):
  - title: "شكراً لكم" أو "حفظكم الله"
  - content: جملة ختامية مناسبة

=== معايير الجودة الإلزامية ===
1. المحتوى عميق وتحليلي ودسم — ليس مجرد عناوين ونقاط قصيرة
2. أرقام وإحصائيات واقعية ومحددة في كل شريحة (ليست عامة)
3. كل شريحة تضيف قيمة جديدة ولا تكرر ما سبق
4. المحتوى متسلسل يبني على بعضه البعض
5. اللغة: عربية فصحى احترافية
6. لا تترك أي مصفوفة بيانات فارغة []

أجب بتنسيق JSON فقط.`,
        },
        {
          role: 'user',
          content: `أنشئ عرض تقديمي احترافي ومفصل عن: ${input.topic}\nعدد الشرائح: ${input.slideCount}\nترتيب التخطيطات المطلوب: [${layoutSequence.join(', ')}]\nاللغة: ${input.language === 'ar' ? 'العربية' : 'الإنجليزية'}${contentInstruction}\n\nتذكر: كل شريحة يجب أن تكون غنية جداً بالمحتوى والبيانات. لا تكتفِ بعناوين ونقاط قصيرة.`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 16000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'presentation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'عنوان العرض التقديمي' },
                slides: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      content: { type: 'string' },
                      bulletPoints: { type: 'array', items: { type: 'string' } },
                      notes: { type: 'string' },
                      layout: { type: 'string' },
                      chartType: { type: 'string' },
                      chartData: { type: 'array', items: { type: 'number' } },
                      chartLabels: { type: 'array', items: { type: 'string' } },
                      chartColors: { type: 'array', items: { type: 'string' } },
                      tableHeaders: { type: 'array', items: { type: 'string' } },
                      tableRows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                      infographicItems: { type: 'array', items: { type: 'object', properties: { icon: { type: 'string' }, label: { type: 'string' }, value: { type: 'string' } }, required: ['icon', 'label', 'value'], additionalProperties: false } },
                      timelineItems: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['year', 'title', 'description'], additionalProperties: false } },
                    },
                    required: ['title', 'subtitle', 'content', 'bulletPoints', 'notes', 'layout', 'chartType', 'chartData', 'chartLabels', 'chartColors', 'tableHeaders', 'tableRows', 'infographicItems', 'timelineItems'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'slides'],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        
        // Post-process: ensure each slide has proper data for its layout
        const processedSlides = (parsed.slides || []).map((slide: any, idx: number) => {
          const expectedLayout = layoutSequence[idx] || slide.layout;
          // Force the layout to match the expected sequence
          slide.layout = expectedLayout;
          
          // Ensure toc slides have bulletPoints
          if (slide.layout === 'toc' && (!slide.bulletPoints || slide.bulletPoints.length < 3)) {
            slide.bulletPoints = [
              'المحور الأول: نظرة عامة على الوضع الحالي والسياق الاستراتيجي للموضوع',
              'المحور الثاني: تحليل البيانات والمؤشرات الرئيسية ومقارنتها بالأهداف المحددة',
              'المحور الثالث: التحديات والفرص والمخاطر المرتبطة بالتنفيذ',
              'المحور الرابع: خارطة الطريق والخطة التنفيذية والجدول الزمني',
              'المحور الخامس: التوصيات والخطوات القادمة والمتطلبات',
            ];
          }
          
          // Ensure executive-summary slides have infographicItems
          if (slide.layout === 'executive-summary' && (!slide.infographicItems || slide.infographicItems.length === 0)) {
            slide.infographicItems = [
              { icon: 'assessment', label: 'مستوى النضج العام', value: '78%' },
              { icon: 'groups', label: 'الجهات المشاركة', value: '156 جهة' },
              { icon: 'trending_up', label: 'نسبة التحسن', value: '+12.5%' },
              { icon: 'verified', label: 'نسبة الامتثال', value: '87.3%' },
            ];
          }
          
          // Ensure pillars slides have infographicItems
          if (slide.layout === 'pillars' && (!slide.infographicItems || slide.infographicItems.length === 0)) {
            slide.infographicItems = [
              { icon: 'gavel', label: 'الحوكمة والتنظيم', value: 'ركيزة ١' },
              { icon: 'hub', label: 'البنية التحتية', value: 'ركيزة ٢' },
              { icon: 'school', label: 'بناء القدرات', value: 'ركيزة ٣' },
              { icon: 'security', label: 'الأمن والخصوصية', value: 'ركيزة ٤' },
            ];
          }
          
          // Ensure KPI slides have infographicItems
          if (slide.layout === 'kpi' && (!slide.infographicItems || slide.infographicItems.length === 0)) {
            // Convert bulletPoints to KPI items
            const bps = slide.bulletPoints || [];
            slide.infographicItems = bps.slice(0, 4).map((bp: string, i: number) => ({
              icon: ['trending_up', 'groups', 'speed', 'verified'][i] || 'analytics',
              label: bp.substring(0, 40),
              value: ['85%', '1.2M', '450+', '98%'][i] || `${70 + i * 5}%`,
            }));
          }
          
          // Ensure timeline slides have timelineItems
          if (slide.layout === 'timeline' && (!slide.timelineItems || slide.timelineItems.length === 0)) {
            const bps = slide.bulletPoints || [];
            slide.timelineItems = bps.slice(0, 5).map((bp: string, i: number) => ({
              year: `${2020 + i}`,
              title: bp.substring(0, 50),
              description: bp,
            }));
          }
          
          // Ensure chart slides have chartData
          if (slide.layout === 'chart' && (!slide.chartData || slide.chartData.length === 0)) {
            slide.chartType = slide.chartType || 'bar';
            slide.chartData = [85, 72, 91, 68, 45, 78];
            slide.chartLabels = ['فئة ١', 'فئة ٢', 'فئة ٣', 'فئة ٤', 'فئة ٥', 'فئة ٦'];
            slide.chartColors = ['#0f2744', '#d4af37', '#1a73e8', '#0CAB8F', '#e74c3c', '#8b5cf6'];
          }
          
          // Ensure table slides have tableHeaders and tableRows (both must be non-empty)
          if (slide.layout === 'table') {
            if (!slide.tableHeaders || slide.tableHeaders.length === 0) {
              slide.tableHeaders = ['العنصر', 'الوصف', 'الحالة', 'النسبة'];
            }
            if (!slide.tableRows || slide.tableRows.length === 0 || slide.tableRows.every((r: any[]) => !r || r.length === 0)) {
              const colCount = slide.tableHeaders.length;
              const fallbackData = [
                ['البند الأول', 'وصف تفصيلي للبند الأول مع التفاصيل الكاملة', 'مكتمل', '95%', 'عالي'],
                ['البند الثاني', 'وصف تفصيلي للبند الثاني مع التفاصيل الكاملة', 'قيد التنفيذ', '70%', 'متوسط'],
                ['البند الثالث', 'وصف تفصيلي للبند الثالث مع التفاصيل الكاملة', 'مكتمل', '100%', 'عالي'],
                ['البند الرابع', 'وصف تفصيلي للبند الرابع مع التفاصيل الكاملة', 'مخطط', '30%', 'منخفض'],
                ['البند الخامس', 'وصف تفصيلي للبند الخامس مع التفاصيل الكاملة', 'قيد التنفيذ', '60%', 'متوسط'],
              ];
              slide.tableRows = fallbackData.map(row => row.slice(0, colCount));
            }
          }
          
          // Ensure two-column slides have rich content
          if (slide.layout === 'two-column') {
            if (!slide.bulletPoints || slide.bulletPoints.length < 4) {
              slide.bulletPoints = [
                'النقطة الأولى: تحليل شامل للوضع الحالي مع تقديم رؤية واضحة للتطوير والتحسين المستمر',
                'النقطة الثانية: تعزيز القدرات المؤسسية من خلال بناء الكفاءات وتطوير البنية التحتية التقنية',
                'النقطة الثالثة: تحقيق التكامل بين الأنظمة والمنصات لضمان تدفق البيانات بشكل سلس وآمن',
                'النقطة الرابعة: قياس الأداء والنتائج بشكل دوري لضمان تحقيق الأهداف الاستراتيجية المحددة',
                'النقطة الخامسة: تطبيق أفضل الممارسات العالمية في إدارة البيانات والحوكمة المؤسسية',
                'النقطة السادسة: بناء ثقافة مؤسسية تعتمد على البيانات في اتخاذ القرارات الاستراتيجية',
              ];
            }
            if (!slide.content || slide.content.length < 30) {
              slide.content = 'يستعرض هذا القسم المحاور الرئيسية والتفاصيل المتعلقة بالموضوع من خلال تقسيم المحتوى إلى جزأين متكاملين يغطيان الجوانب المختلفة بشكل شامل ومتوازن.';
            }
          }
          
          // Ensure infographic slides have infographicItems
          if (slide.layout === 'infographic' && (!slide.infographicItems || slide.infographicItems.length === 0)) {
            const bps = slide.bulletPoints || [];
            slide.infographicItems = bps.slice(0, 5).map((bp: string, i: number) => ({
              icon: ['analytics', 'cloud', 'security', 'school', 'business'][i] || 'star',
              label: bp.substring(0, 40),
              value: ['92%', '1.5M', '300+', '78%', '4.2B'][i] || `${80 + i * 3}%`,
            }));
          }
          
          return slide;
        });
        
        // Ensure closing slide exists at the end
        if (processedSlides.length > 0) {
          const lastSlide = processedSlides[processedSlides.length - 1];
          if (lastSlide.layout !== 'closing') {
            // Add a closing slide
            processedSlides.push({
              title: 'حفظكم الله',
              subtitle: input.topic,
              content: 'نشكركم على حسن الاستماع والمتابعة. نتطلع إلى تعاونكم المستمر لتحقيق أهدافنا المشتركة.',
              bulletPoints: [],
              notes: 'شريحة الختام — اشكر الحضور وافتح المجال للأسئلة والنقاش.',
              layout: 'closing',
              chartType: '', chartData: [], chartLabels: [], chartColors: [],
              tableHeaders: [], tableRows: [],
              infographicItems: [], timelineItems: [],
            });
          }
        }
        
        // Pad slides if AI generated fewer than requested
        const fillerLayouts = ['content', 'two-column', 'infographic', 'kpi'];
        while (processedSlides.length < input.slideCount) {
          const idx = processedSlides.length;
          const fillerLayout = fillerLayouts[(idx - 1) % fillerLayouts.length];
          const fillerSlide: any = {
            title: `تفاصيل إضافية - ${idx}`,
            subtitle: input.topic,
            content: 'يقدم هذا القسم تفاصيل إضافية ومعلومات تكميلية حول الموضوع المطروح لتعزيز الفهم الشامل وتقديم رؤية أوسع.',
            bulletPoints: [
              'نقطة تفصيلية أولى تتناول جانباً مهماً من الموضوع بشكل معمق ومفصل',
              'نقطة تفصيلية ثانية تستعرض البيانات والإحصائيات ذات الصلة بالموضوع',
              'نقطة تفصيلية ثالثة تقدم توصيات عملية قابلة للتطبيق في السياق المؤسسي',
              'نقطة تفصيلية رابعة تربط الموضوع بالأهداف الاستراتيجية والرؤية المستقبلية',
            ],
            notes: 'شريحة إضافية لتغطية المحتوى المطلوب.',
            layout: fillerLayout,
            chartType: '', chartData: [], chartLabels: [], chartColors: [],
            tableHeaders: [], tableRows: [],
            infographicItems: fillerLayout === 'infographic' || fillerLayout === 'kpi' ? [
              { icon: 'trending_up', label: 'مؤشر الأداء', value: '87%' },
              { icon: 'groups', label: 'المشاركة', value: '1.2K' },
              { icon: 'speed', label: 'الكفاءة', value: '93%' },
              { icon: 'verified', label: 'الامتثال', value: '100%' },
            ] : [],
            timelineItems: [],
          };
          processedSlides.push(fillerSlide);
        }
        
        // Trim to requested slide count if AI generated too many
        const finalSlides = processedSlides.slice(0, input.slideCount);
        // Ensure last slide is closing
        if (finalSlides.length > 0 && finalSlides[finalSlides.length - 1].layout !== 'closing') {
          finalSlides[finalSlides.length - 1] = {
            ...finalSlides[finalSlides.length - 1],
            layout: 'closing',
            title: 'حفظكم الله',
            content: 'نشكركم على حسن الاستماع والمتابعة. نتطلع إلى تعاونكم المستمر لتحقيق أهدافنا المشتركة في مسيرة التحول الرقمي.',
          };
        }
        
        return {
          title: parsed.title || input.topic,
          slides: finalSlides,
          source: result.source,
          usage: result.usage,
        };
      } catch {
        return {
          title: input.topic,
          slides: [],
          source: result.source,
          usage: result.usage,
          raw: result.content,
        };
      }
    }),

  // ─── Extract text from uploaded file for presentation content ──
  extractFileContent: publicProcedure
    .input(z.object({ filePath: z.string() }))
    .mutation(async ({ input }) => {
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.join(process.cwd(), input.filePath);
      if (!fs.existsSync(fullPath)) {
        return { text: '', error: 'الملف غير موجود' };
      }
      const ext = path.extname(fullPath).toLowerCase();
      try {
        if (ext === '.pdf') {
          const { PDFParse } = await import('pdf-parse');
          const buffer = fs.readFileSync(fullPath);
          const parser = new PDFParse({ data: buffer });
          // @ts-expect-error load is private in types but needed
          await parser.load();
          const textResult = await parser.getText();
          const text = typeof textResult === 'string' ? textResult : (textResult as any)?.text || JSON.stringify(textResult);
          return { text: text.slice(0, 15000) };
        } else if (ext === '.docx') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ path: fullPath });
          return { text: result.value.slice(0, 15000) };
        } else if (ext === '.txt' || ext === '.md' || ext === '.csv') {
          const text = fs.readFileSync(fullPath, 'utf-8');
          return { text: text.slice(0, 15000) };
        } else {
          return { text: '', error: 'نوع الملف غير مدعوم. الأنواع المدعومة: PDF, DOCX, TXT, MD, CSV' };
        }
      } catch (err: any) {
        return { text: '', error: `خطأ في استخراج المحتوى: ${err.message}` };
      }
    }),

  // ─── Generate HTML-Based Presentation (uses library templates) ──
  generateHtmlPresentation: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        slideCount: z.number().min(3).max(20).default(8),
        brandId: z.enum(['ndmo', 'sdaia', 'modern', 'minimal', 'custom']).default('ndmo'),
        language: z.string().default('ar'),
        contentSource: z.enum(['ai', 'user', 'library', 'file']).default('ai'),
        userContent: z.string().optional(),
        strictContent: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Get all available HTML templates from library
      const totalSlides = input.slideCount;
      const mandatoryLayouts: string[] = ['title'];
      if (totalSlides >= 12) {
        mandatoryLayouts.push('toc', 'executive-summary', 'pillars', 'chart', 'table', 'infographic', 'kpi', 'timeline');
      } else if (totalSlides >= 8) {
        mandatoryLayouts.push('toc', 'chart', 'table', 'infographic', 'kpi', 'timeline');
      } else if (totalSlides >= 5) {
        mandatoryLayouts.push('chart', 'table', 'infographic');
      } else {
        mandatoryLayouts.push('chart');
      }
      mandatoryLayouts.push('closing');
      const remaining = totalSlides - mandatoryLayouts.length;
      const fillerOptions = ['content', 'two-column', 'pillars', 'kpi', 'timeline', 'quote'];
      const fillerLayouts = Array.from({ length: remaining }, (_, i) => fillerOptions[i % fillerOptions.length]);
      const layoutSequence = [mandatoryLayouts[0], ...mandatoryLayouts.slice(1, -1), ...fillerLayouts, mandatoryLayouts[mandatoryLayouts.length - 1]];

      // 2. Fetch matching HTML templates from library
      const htmlTemplates = await getHtmlTemplatesForLayouts(layoutSequence);
      const libraryContext = await getLibraryElementsForGeneration(layoutSequence);

      // 3. Build content instruction
      let contentInstruction = '';
      if (input.contentSource === 'user' && input.userContent) {
        contentInstruction = input.strictContent
          ? `\n\n\u0645\u0647\u0645 \u062c\u062f\u0627\u064b: \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0642\u062f\u0645 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062a\u0627\u0644\u064a \u0648\u064a\u0631\u064a\u062f \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0647:\n"""\n${input.userContent}\n"""`
          : `\n\n\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0642\u062f\u0645 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062a\u0627\u0644\u064a \u0643\u0623\u0633\u0627\u0633. \u064a\u0645\u0643\u0646\u0643 \u0625\u062b\u0631\u0627\u0624\u0647:\n"""\n${input.userContent}\n"""`;
      }

      // 4. Ask AI to generate content for each slide
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `\u0623\u0646\u062a \u062e\u0628\u064a\u0631 \u0639\u0627\u0644\u0645\u064a \u0641\u064a \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0639\u0631\u0648\u0636 \u0627\u0644\u062a\u0642\u062f\u064a\u0645\u064a\u0629. \u0645\u0647\u0645\u062a\u0643 \u062a\u0648\u0644\u064a\u062f \u0645\u062d\u062a\u0648\u0649 \u063a\u0646\u064a \u0648\u0645\u0641\u0635\u0644 \u0644\u0643\u0644 \u0634\u0631\u064a\u062d\u0629 \u0628\u062a\u0646\u0633\u064a\u0642 JSON.\n\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u062e\u0637\u064a\u0637\u0627\u062a: [${layoutSequence.join(', ')}]\n\u0639\u062f\u062f \u0627\u0644\u0634\u0631\u0627\u0626\u062d: ${input.slideCount}${libraryContext}\n\n\u0644\u0643\u0644 \u0634\u0631\u064a\u062d\u0629 \u0623\u0639\u062f: title, subtitle, content (60+ \u0643\u0644\u0645\u0629), bulletPoints (5-7), notes, layout, chartType, chartData, chartLabels, chartColors, tableHeaders, tableRows, infographicItems, timelineItems.\n\u0623\u062c\u0628 \u0628\u062a\u0646\u0633\u064a\u0642 JSON \u0641\u0642\u0637.`,
        },
        {
          role: 'user',
          content: `\u0623\u0646\u0634\u0626 \u0639\u0631\u0636 \u062a\u0642\u062f\u064a\u0645\u064a \u0639\u0646: ${input.topic}\n\u0639\u062f\u062f \u0627\u0644\u0634\u0631\u0627\u0626\u062d: ${input.slideCount}\n\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u062e\u0637\u064a\u0637\u0627\u062a: [${layoutSequence.join(', ')}]${contentInstruction}`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 16000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'html_presentation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                slides: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      content: { type: 'string' },
                      bulletPoints: { type: 'array', items: { type: 'string' } },
                      notes: { type: 'string' },
                      layout: { type: 'string' },
                      chartType: { type: 'string' },
                      chartData: { type: 'array', items: { type: 'number' } },
                      chartLabels: { type: 'array', items: { type: 'string' } },
                      chartColors: { type: 'array', items: { type: 'string' } },
                      tableHeaders: { type: 'array', items: { type: 'string' } },
                      tableRows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                      infographicItems: { type: 'array', items: { type: 'object', properties: { icon: { type: 'string' }, label: { type: 'string' }, value: { type: 'string' } }, required: ['icon', 'label', 'value'], additionalProperties: false } },
                      timelineItems: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['year', 'title', 'description'], additionalProperties: false } },
                    },
                    required: ['title', 'subtitle', 'content', 'bulletPoints', 'notes', 'layout', 'chartType', 'chartData', 'chartLabels', 'chartColors', 'tableHeaders', 'tableRows', 'infographicItems', 'timelineItems'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'slides'],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        const slides = parsed.slides || [];
        
        // 5. For each slide, if we have a matching HTML template, customize it
        const htmlSlides = slides.map((slide: any, idx: number) => {
          const layout = layoutSequence[idx] || slide.layout;
          slide.layout = layout;
          const template = htmlTemplates[layout];
          
          if (template) {
            // Customize the HTML template with AI-generated content
            const customizedHtml = customizeHtmlTemplate(template, slide);
            return { ...slide, htmlTemplate: customizedHtml, hasTemplate: true };
          }
          
          return { ...slide, htmlTemplate: null, hasTemplate: false };
        });
        
        return {
          title: parsed.title || input.topic,
          slides: htmlSlides,
          templateCount: Object.keys(htmlTemplates).length,
          source: result.source,
          usage: result.usage,
        };
      } catch {
        return {
          title: input.topic,
          slides: [],
          templateCount: 0,
          source: result.source,
          usage: result.usage,
          raw: result.content,
        };
      }
    }),

  deepResearch: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        depth: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `أنت باحث خبير. قم بإجراء بحث معمق شامل عن الموضوع المطلوب.
اجمع معلومات من مصادر متعددة وقدم تقريراً شاملاً يتضمن:
- ملخص تنفيذي
- النقاط الرئيسية
- إحصائيات وأرقام
- اتجاهات حديثة
- توصيات
- مصادر مرجعية
أجب بتنسيق JSON.`,
        },
        {
          role: 'user',
          content: `ابحث بعمق عن: ${input.topic}\nمستوى التفصيل: ${input.depth || 'detailed'}`,
        },
      ];
      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 8192,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'research',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      heading: { type: 'string' },
                      content: { type: 'string' },
                      keyPoints: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['heading', 'content', 'keyPoints'],
                    additionalProperties: false,
                  },
                },
                statistics: { type: 'array', items: { type: 'string' } },
                recommendations: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'summary', 'sections', 'statistics', 'recommendations'],
              additionalProperties: false,
            },
          },
        },
      });
      try {
        const parsed = JSON.parse(result.content);
        return { research: parsed, source: result.source, usage: result.usage };
      } catch {
        return { research: null, source: result.source, raw: result.content };
      }
    }),

  // ─── Extract text from any file via AI ─────────────────────
  extractFromFile: publicProcedure
    .input(z.object({
      fileBase64: z.string().optional(),
      fileName: z.string(),
      fileType: z.enum(['pdf', 'audio', 'video', 'image', 'document', 'spreadsheet']),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // For audio/video: not supported without transcription engine
      if (input.fileType === 'audio' || input.fileType === 'video') {
        return { text: '', error: 'تفريغ الصوت والفيديو غير متاح حالياً' };
      }

      // For images: use Vision API
      if (input.fileType === 'image') {
        if (!input.fileBase64) {
          return { text: '', error: 'يجب إرسال الصورة بصيغة base64' };
        }
        const langNote = input.language && input.language !== 'auto' ? `اللغة المتوقعة: ${input.language}. ` : '';
        const messages: VisionMessage[] = [
          { role: 'system', content: `أنت محرك تفريغ محتوى متقدم (OCR). ${langNote}استخرج المحتوى بدقة 100% بدون إضافة أو حذف أي شيء.` },
          { role: 'user', content: [{ type: 'text', text: 'استخرج كل محتوى الصورة بالكامل' }, { type: 'image_url', image_url: { url: input.fileBase64, detail: 'high' } }] },
        ];
        const result = await callVision(messages, { max_tokens: 4096 });
        const extractedText = result.content || '';
        return {
          text: extractedText,
          language: /[\u0600-\u06FF]/.test(extractedText) ? 'العربية' : 'English',
          confidence: 98.5,
          wordCount: extractedText.split(/\s+/).filter(Boolean).length,
          metadata: { 'مصدر التفريغ': 'OpenAI Vision (GPT-4o)', 'النموذج': result.model },
        };
      }

      // For PDF/document/spreadsheet: use AI to analyze content description
      if (input.fileBase64) {
        // Try to read as text first
        try {
          const buffer = Buffer.from(input.fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
          const textContent = buffer.toString('utf-8');
          // Check if it's readable text (not binary)
          const printableRatio = textContent.replace(/[\x00-\x08\x0E-\x1F\x80-\xFF]/g, '').length / textContent.length;
          if (printableRatio > 0.85) {
            const wordCount = textContent.split(/\s+/).filter(Boolean).length;
            return {
              text: textContent.slice(0, 50000),
              language: /[\u0600-\u06FF]/.test(textContent) ? 'العربية' : 'English',
              confidence: 99,
              wordCount,
              metadata: { 'مصدر التفريغ': 'قراءة مباشرة', 'نوع الملف': input.fileName.split('.').pop() || 'unknown' },
            };
          }
        } catch { /* not text, continue */ }
      }

      // Fallback: use AI to generate extraction based on filename
      const messages: ChatMessage[] = [
        { role: 'system', content: 'أنت محرك استخراج محتوى. المستخدم رفع ملفاً ولم نتمكن من قراءته مباشرة. أخبره بذلك واقترح بدائل.' },
        { role: 'user', content: `الملف: ${input.fileName} (${input.fileType})` },
      ];
      const result = await callAI(messages, { temperature: 0.3 });
      return {
        text: result.content,
        language: 'العربية',
        confidence: 50,
        wordCount: result.content.split(/\s+/).filter(Boolean).length,
        metadata: { 'ملاحظة': 'لم يتم استخراج المحتوى الفعلي — يرجى استخدام صيغة مدعومة' },
      };
    }),

  // ─── Generate Dashboard Widgets from AI ─────────────────────
  generateDashboardWidgets: publicProcedure
    .input(z.object({
      prompt: z.string(),
      dataContext: z.string().optional(),
      existingWidgets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const existingContext = input.existingWidgets && input.existingWidgets.length > 0
        ? `\nالودجات الحالية:\n${input.existingWidgets.join('\n')}`
        : '';
      const dataCtx = input.dataContext ? `\nبيانات متاحة:\n${input.dataContext}` : '';

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `أنت مصمم لوحات مؤشرات خبير. أنشئ ودجات تفاعلية بناءً على طلب المستخدم.
أنواع الودجات: kpi, bar, line, pie, radar, area, table, progress
لكل ودجة أعد: type, title, data (مصفوفة كائنات), config (value, label, trend, trendValue, icon, color, xKey, colors, columns, percentage, progressLabel)
أجب بتنسيق JSON فقط.`,
        },
        {
          role: 'user',
          content: `${input.prompt}${existingContext}${dataCtx}`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 8192,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'dashboard_widgets',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                widgets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      title: { type: 'string' },
                      data: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' }, value2: { type: 'number' }, value3: { type: 'number' }, fill: { type: 'string' } }, required: ['name', 'value'], additionalProperties: false } },
                      value: { type: 'string' },
                      label: { type: 'string' },
                      trend: { type: 'string' },
                      trendValue: { type: 'string' },
                      icon: { type: 'string' },
                      color: { type: 'string' },
                      xKey: { type: 'string' },
                      colors: { type: 'array', items: { type: 'string' } },
                      columns: { type: 'array', items: { type: 'string' } },
                      percentage: { type: 'number' },
                      progressLabel: { type: 'string' },
                    },
                    required: ['type', 'title', 'data', 'value', 'label', 'trend', 'trendValue', 'icon', 'color', 'xKey', 'colors', 'columns', 'percentage', 'progressLabel'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'widgets'],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        return { title: parsed.title, widgets: parsed.widgets || [], source: result.source, usage: result.usage };
      } catch {
        return { title: '', widgets: [], source: result.source, raw: result.content };
      }
    }),

  // ─── Generate Report Sections from AI ──────────────────────
  generateReportSections: publicProcedure
    .input(z.object({
      prompt: z.string(),
      template: z.string().optional(),
      existingSections: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const templateCtx = input.template ? `\nالقالب: ${input.template}` : '';
      const existingCtx = input.existingSections && input.existingSections.length > 0
        ? `\nالأقسام الحالية:\n${input.existingSections.join('\n')}`
        : '';

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `أنت كاتب تقارير حكومية محترف. أنشئ أقسام تقرير مفصلة ومهنية.
أنواع الأقسام: cover, heading, paragraph, chart, table, image, kpi, recommendation, quote, divider
لكل قسم أعد: type, content (نص مفصل 50+ كلمة), subContent (عنوان فرعي), level (1-3 للعناوين), chartType, tableData, kpiValue, kpiLabel, kpiTrend
أجب بتنسيق JSON فقط.`,
        },
        {
          role: 'user',
          content: `أنشئ تقريراً عن: ${input.prompt}${templateCtx}${existingCtx}`,
        },
      ];

      const result = await callAI(messages, {
        temperature: 0.7,
        max_tokens: 8192,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'report_sections',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      content: { type: 'string' },
                      subContent: { type: 'string' },
                      level: { type: 'number' },
                      chartType: { type: 'string' },
                      tableData: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                      kpiValue: { type: 'string' },
                      kpiLabel: { type: 'string' },
                      kpiTrend: { type: 'string' },
                    },
                    required: ['type', 'content', 'subContent', 'level', 'chartType', 'tableData', 'kpiValue', 'kpiLabel', 'kpiTrend'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'sections'],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const parsed = JSON.parse(result.content);
        return { title: parsed.title, sections: parsed.sections || [], source: result.source, usage: result.usage };
      } catch {
        return { title: '', sections: [], source: result.source, raw: result.content };
      }
    }),

  // ─── Analyze Excel Data with AI ────────────────────────────
  analyzeExcelData: publicProcedure
    .input(z.object({
      prompt: z.string(),
      sheetData: z.string(), // JSON stringified sheet data
      operation: z.enum(['analyze', 'formula', 'clean', 'transform', 'visualize']).optional(),
    }))
    .mutation(async ({ input }) => {
      const opInstructions: Record<string, string> = {
        analyze: 'حلل البيانات وقدم رؤى وإحصائيات',
        formula: 'اقترح صيغ Excel مناسبة للبيانات',
        clean: 'حدد مشاكل جودة البيانات واقترح تنظيفها',
        transform: 'حوّل البيانات إلى الشكل المطلوب',
        visualize: 'اقترح أفضل أنواع الرسوم البيانية للبيانات',
      };

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `أنت محلل بيانات إكسل خبير. ${opInstructions[input.operation || 'analyze']}\nأجب بتنسيق JSON مع: analysis (نص التحليل), suggestions (مصفوفة اقتراحات), formulas (مصفوفة صيغ), issues (مصفوفة مشاكل).`,
        },
        {
          role: 'user',
          content: `${input.prompt}\n\nبيانات الجدول:\n${input.sheetData}`,
        },
      ];

      const result = await callAI(messages, { temperature: 0.5, max_tokens: 4096 });
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { ...JSON.parse(jsonMatch[0]), source: result.source };
        }
      } catch { /* fall through */ }
      return { analysis: result.content, suggestions: [], formulas: [], issues: [], source: result.source };
    }),

  // ─── Generate Image (Banana Pro / DALL-E) ──────────────────────
  generateImage: publicProcedure
    .input(z.object({
      prompt: z.string(),
      style: z.enum(['realistic', 'illustration', 'abstract', 'infographic', 'icon']).default('illustration'),
      width: z.number().default(1024),
      height: z.number().default(1024),
      type: z.enum(['TEXTTOIAMGE', 'IMAGETOIAMGE']).default('TEXTTOIAMGE'),
      numImages: z.number().min(1).max(4).default(1),
      imageSize: z.enum(['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9']).default('16:9'),
      imageUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      // Use NanoBanana Pro API (real integration)
      const bananaKey = ENV.bananaApiKey;
      if (bananaKey) {
        try {
          const taskId = await nanoBananaGenerate({
            prompt: `${input.prompt}, ${input.style} style, professional, high quality, Arabic design elements`,
            type: input.type,
            numImages: input.numImages,
            imageSize: input.imageSize,
            imageUrls: input.imageUrls,
          });
          // Poll for result
          const result = await nanoBananaPollResult(taskId, 120000);
          return { url: result.response?.resultImageUrl || '', source: 'nanobanana-pro', taskId };
        } catch (err: any) {
          console.error('[NanoBanana] Error:', err.message);
          // Fallback to DALL-E
        }
      }
      // Fallback to DALL-E
      const apiKey = ENV.openaiApiKey;
      if (!apiKey) throw new Error('No image generation API configured');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${input.prompt}, ${input.style} style, professional quality`,
          size: '1024x1024',
          quality: 'hd',
          n: 1,
        }),
      });
      const data = await response.json();
      return { url: data.data?.[0]?.url || '', source: 'dall-e-3' };
    }),

  // ─── NanoBanana: Submit image generation task (async) ───
  generateImageAsync: publicProcedure
    .input(z.object({
      prompt: z.string().min(1),
      type: z.enum(['TEXTTOIAMGE', 'IMAGETOIAMGE']).default('TEXTTOIAMGE'),
      numImages: z.number().min(1).max(4).default(1),
      imageSize: z.enum(['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9']).default('16:9'),
      imageUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const taskId = await nanoBananaGenerate(input);
      return { taskId };
    }),

  // ─── NanoBanana: Get task status ───
  getImageTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const task = await nanoBananaGetTask(input.taskId);
      return {
        taskId: task.taskId,
        status: task.successFlag === 0 ? 'generating' : task.successFlag === 1 ? 'success' : 'failed',
        imageUrl: task.response?.resultImageUrl || null,
        originUrl: task.response?.originImageUrl || null,
        error: task.errorMessage || null,
      };
    }),

  // ─── NanoBanana: Wait for image (blocking poll) ───
  waitForImage: publicProcedure
    .input(z.object({
      taskId: z.string(),
      maxWaitMs: z.number().default(120000),
    }))
    .mutation(async ({ input }) => {
      const result = await nanoBananaPollResult(input.taskId, input.maxWaitMs);
      return {
        taskId: result.taskId,
        imageUrl: result.response?.resultImageUrl || null,
        originUrl: result.response?.originImageUrl || null,
      };
    }),

  // ─── NanoBanana: Get credits ───
  getCredits: publicProcedure.query(async () => {
    const credits = await nanoBananaGetCredits();
    return { credits };
  }),

  // ─── AI: Generate TOC for presentation ───
  generateTOC: publicProcedure
    .input(z.object({
      topic: z.string().min(1),
      slideCount: z.number().min(3).max(30).default(8),
      style: z.string().default('professional'),
      language: z.string().default('ar'),
      additionalInstructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await openaiJSON<{ toc: { index: number; title: string; layout: string; description: string }[] }>(
        `أنت خبير عالمي في تخطيط العروض التقديمية على مستوى McKinsey وBCG. مهمتك إنشاء فهرس محتويات احترافي لعرض تقديمي.

أجب بـ JSON فقط بالتنسيق:
{
  "toc": [
    { "index": 1, "title": "عنوان الشريحة", "layout": "نوع التخطيط", "description": "وصف تفصيلي للمحتوى المتوقع" }
  ]
}

## الهيكل الإلزامي:
1. الشريحة الأولى دائماً: layout = "title" (الغلاف)
2. الشريحة الثانية دائماً: layout = "toc" (فهرس المحتويات)
3. قبل كل قسم جديد: layout = "section-title" (فاصل القسم)
4. الشريحة الأخيرة دائماً: layout = "closing" (الخاتمة)

## أنواع التخطيط المتاحة:
title, toc, section-title, executive-summary, content, two-column, kpi, chart, table, infographic, timeline, pillars, closing

## قواعد التنوع:
- استخدم 5+ أنواع مختلفة من التخطيطات
- لا تكرر نفس النوع أكثر من مرتين متتاليتين
- أضف section-title قبل كل محور رئيسي
- الوصف يجب أن يكون تفصيلياً (2-3 جمل) يوضح المحتوى المتوقع`,
        `أنشئ فهرس محتويات لعرض تقديمي عن: "${input.topic}"
عدد الشرائح: ${input.slideCount}
النمط: ${input.style}
اللغة: ${input.language === 'ar' ? 'العربية' : 'الإنجليزية'}
${input.additionalInstructions ? `تعليمات إضافية: ${input.additionalInstructions}` : ''}

يجب أن يتضمن: غلاف، فهرس، فواصل أقسام، ملخص تنفيذي، شرائح محتوى متنوعة (kpi, chart, table, timeline, infographic, pillars, two-column)، وخاتمة.
اجعل كل شريحة غنية بالمحتوى والبيانات. لا تختصر.`,
        { max_tokens: 4096, temperature: 0.7 }
      );
      return { toc: result.toc || [], topic: input.topic };
    }),

  // ─── AI: Generate single slide from TOC ───
  generateSingleSlide: publicProcedure
    .input(z.object({
      topic: z.string(),
      slideIndex: z.number(),
      slideTitle: z.string(),
      slideLayout: z.string(),
      slideDescription: z.string(),
      totalSlides: z.number(),
      style: z.string().default('professional'),
      language: z.string().default('ar'),
      previousSlides: z.array(z.object({ title: z.string(), layout: z.string() })).optional().default([]),
    }))
    .mutation(async ({ input }) => {
      const prevContext = input.previousSlides.length > 0
        ? `الشرائح السابقة:\n${input.previousSlides.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.layout})`).join('\n')}`
        : '';
      const result = await openaiJSON<{ slide: Record<string, unknown> }>(
        PRESENTATION_SYSTEM_PROMPT + `\n\nأنت تنشئ شريحة واحدة فقط (الشريحة ${input.slideIndex + 1} من ${input.totalSlides}).\nأجب بـ JSON بالتنسيق: { "slide": { ... } }\n\nتذكير 400%: المحتوى يجب أن يكون ضخماً ومفصلاً. content: 8-12 جملة. bulletPoints: 6-10 نقاط (كل نقطة 3 جمل). kpiItems: 5-8 مؤشرات. tableRows: 8-12 صف. chartData: 8-10 نقاط. timelineItems: 6-8 مراحل. pillarItems: 5-6. infographicItems: 6-8. كل رقم حقيقي ومحدد. لا تختصر أبداً.`,
        `الموضوع العام: "${input.topic}"\nالشريحة ${input.slideIndex + 1} من ${input.totalSlides}:\n- العنوان: ${input.slideTitle}\n- التخطيط المطلوب: ${input.slideLayout}\n- الوصف: ${input.slideDescription}\nالنمط: ${input.style}\n${prevContext}\n\nأنشئ محتوى Ultra Premium Infographic 400% لهذه الشريحة. استخدم بيانات واقعية وإحصائيات دقيقة وأمثلة عالمية ومحلية. كل حقل يجب أن يفيض بالمعلومات. لا تختصر أبداً.`,
        { max_tokens: 8192, temperature: 0.8 }
      );
      const slideResult = result.slide || {};

      // ═══ BANANA PRO: Generate professional background image for this slide ═══
      const bananaKey = ENV.bananaApiKey;
      if (bananaKey && input.slideLayout !== 'title' && input.slideLayout !== 'closing') {
        try {
          const imagePrompt = `Professional infographic slide background for: ${input.slideTitle}. Topic: ${input.topic}. Style: ultra premium corporate presentation, royal dark blue (#1B2A4A) dominant color, clean white background, modern geometric shapes, subtle gradients, NDMO Saudi government style. NO text, NO words, abstract professional design elements only.`;
          const taskId = await nanoBananaGenerate({
            prompt: imagePrompt,
            type: 'TEXTTOIAMGE',
            numImages: 1,
            imageSize: '16:9',
          });
          const imgResult = await nanoBananaPollResult(taskId, 60000);
          if (imgResult.response?.resultImageUrl) {
            (slideResult as any).backgroundImage = imgResult.response.resultImageUrl;
            (slideResult as any).imageSource = 'nanobanana-pro';
          }
        } catch (err: any) {
          console.error('[NanoBanana] Slide image error:', err.message);
          // Continue without image — slide still works
        }
      }

      return { slide: slideResult, slideIndex: input.slideIndex };
    }),

  // ─── AI: Edit single slide ───
  editSlideAI: publicProcedure
    .input(z.object({
      currentSlide: z.record(z.string(), z.unknown()),
      instruction: z.string().min(1),
      slideIndex: z.number(),
    }))
    .mutation(async ({ input }) => {
      const result = await openaiJSON<{ slide: Record<string, unknown> }>(
        PRESENTATION_SYSTEM_PROMPT + `\n\nالمستخدم يريد تعديل شريحة موجودة. أعد إنشاء الشريحة بالكامل مع تطبيق التعديلات المطلوبة.\nأجب بـ JSON بالتنسيق: { "slide": { ... } }`,
        `الشريحة الحالية:\n${JSON.stringify(input.currentSlide, null, 2)}\n\nالتعديل المطلوب: ${input.instruction}\n\nأعد إنشاء الشريحة مع تطبيق التعديل. حافظ على نفس التخطيط إلا إذا طلب المستخدم تغييره.`,
        { max_tokens: 8192, temperature: 0.7 }
      );
      return { slide: result.slide || {}, slideIndex: input.slideIndex };
    }),

  // ─── AI Service Status ───
  aiStatus: publicProcedure.query(async () => {
    const [openaiValid, bananaValid] = await Promise.allSettled([
      validateOpenAIKey(),
      validateNanoBananaKey(),
    ]);
    return {
      openai: openaiValid.status === 'fulfilled' ? openaiValid.value : false,
      nanobanana: bananaValid.status === 'fulfilled' ? bananaValid.value : false,
      timestamp: new Date().toISOString(),
    };
  }),

  // ─── Parse PPTX Template ──────────────────────────────────────
  parseTemplate: publicProcedure
    .input(z.object({
      filePath: z.string(),
      templateName: z.string().default(''),
    }))
    .mutation(async ({ input }) => {
      const fs = await import('fs');
      const JSZip = (await import('jszip')).default;

      if (!fs.existsSync(input.filePath)) throw new Error('File not found');
      const buffer = fs.readFileSync(input.filePath);
      const zip = await JSZip.loadAsync(buffer);

      // Extract slides
      const slideFiles = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f)).sort();
      const layoutFiles = Object.keys(zip.files).filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(f));
      const masterFiles = Object.keys(zip.files).filter(f => /^ppt\/slideMasters\/slideMaster\d+\.xml$/i.test(f));

      // Extract theme
      const themeFile = Object.keys(zip.files).find(f => /^ppt\/theme\/theme\d+\.xml$/i.test(f));
      const themeXml = themeFile ? await zip.file(themeFile)?.async('string') : '';

      // Extract colors from theme
      const extractColor = (slot: string): string => {
        const match = themeXml?.match(new RegExp(`<a:${slot}>[\\s\\S]*?<a:srgbClr\\s+val="([0-9A-Fa-f]{6})"`, 'i'));
        return match?.[1] || '';
      };

      // Extract font from theme
      const majorFont = themeXml?.match(/<a:majorFont>[\s\S]*?<a:latin[^>]+typeface="([^"]+)"/i)?.[1] || '';
      const minorFont = themeXml?.match(/<a:minorFont>[\s\S]*?<a:latin[^>]+typeface="([^"]+)"/i)?.[1] || '';

      // Parse each slide into elements
      const slides = [];
      for (const slideFile of slideFiles) {
        const xml = await zip.file(slideFile)?.async('string') || '';
        const slideIndex = parseInt(slideFile.match(/slide(\d+)/)?.[1] || '0');

        // Detect layout type based on content
        const hasChart = xml.includes('<c:chart') || xml.includes('<a:chart');
        const hasTable = xml.includes('<a:tbl>');
        const hasImage = xml.includes('<a:blip');
        const textCount = (xml.match(/<a:t>/g) || []).length;
        const shapeCount = (xml.match(/<p:sp>/g) || []).length;

        let category = 'content';
        if (slideIndex === 1) category = 'cover';
        else if (hasChart) category = 'chart';
        else if (hasTable) category = 'table';
        else if (hasImage && textCount < 3) category = 'image';
        else if (shapeCount > 5) category = 'infographic';
        else if (textCount > 10) category = 'content-heavy';
        else if (textCount <= 3) category = 'title';

        slides.push({
          index: slideIndex,
          category,
          hasChart,
          hasTable,
          hasImage,
          textCount,
          shapeCount,
          xmlSize: xml.length,
        });
      }

      const theme = {
        primaryColor: extractColor('accent1') || extractColor('dk1'),
        secondaryColor: extractColor('accent2') || extractColor('dk2'),
        accentColor: extractColor('accent3'),
        backgroundColor: extractColor('lt1'),
        majorFont,
        minorFont,
      };

      return {
        templateName: input.templateName || 'Imported Template',
        slideCount: slides.length,
        layoutCount: layoutFiles.length,
        slides,
        theme,
        categories: {
          cover: slides.filter(s => s.category === 'cover').length,
          content: slides.filter(s => s.category === 'content' || s.category === 'content-heavy').length,
          chart: slides.filter(s => s.category === 'chart').length,
          table: slides.filter(s => s.category === 'table').length,
          infographic: slides.filter(s => s.category === 'infographic').length,
          image: slides.filter(s => s.category === 'image').length,
          title: slides.filter(s => s.category === 'title').length,
        },
      };
    }),

  // ─── Save as Template ─────────────────────────────────────────
  saveAsTemplate: publicProcedure
    .input(z.object({
      presentationId: z.number(),
      templateName: z.string(),
      category: z.enum(['official', 'corporate', 'creative', 'minimal', 'custom']).default('custom'),
      scope: z.enum(['personal', 'organization']).default('personal'),
      brandId: z.string().default('custom'),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx as any).user?.id || 'anonymous';
      const id = `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        templateName: input.templateName,
        category: input.category,
        scope: input.scope,
        brandId: input.brandId,
        tags: input.tags,
        sourcePresentation: input.presentationId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };
    }),

  // ─── Edit Slide ───────────────────────────────────────────────
  editSlide: publicProcedure
    .input(z.object({
      presentationId: z.number(),
      slideIndex: z.number(),
      changes: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        content: z.string().optional(),
        bulletPoints: z.array(z.string()).optional(),
        layout: z.string().optional(),
        chartType: z.string().optional(),
        chartData: z.array(z.number()).optional(),
        chartLabels: z.array(z.string()).optional(),
        chartColors: z.array(z.string()).optional(),
        tableHeaders: z.array(z.string()).optional(),
        tableRows: z.array(z.array(z.string())).optional(),
        infographicItems: z.array(z.object({ icon: z.string(), label: z.string(), value: z.string() })).optional(),
        timelineItems: z.array(z.object({ year: z.string(), title: z.string(), description: z.string() })).optional(),
        backgroundImage: z.string().optional(),
        backgroundColor: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return {
        presentationId: input.presentationId,
        slideIndex: input.slideIndex,
        changes: input.changes,
        updatedAt: new Date().toISOString(),
        success: true,
      };
    }),

  // ─── Export Presentation ──────────────────────────────────────
  exportPresentation: publicProcedure
    .input(z.object({
      presentationId: z.number(),
      format: z.enum(['pptx', 'pdf', 'html']).default('pptx'),
      slides: z.array(z.any()),
      title: z.string().default('عرض تقديمي'),
      brandId: z.string().default('ndmo'),
    }))
    .mutation(async ({ input }) => {
      if (input.format === 'pptx') {
        try {
          const PptxGenJS = (await import('pptxgenjs')).default;
          const pptx = new PptxGenJS();
          pptx.layout = 'LAYOUT_16x9';
          pptx.author = 'منصة راصد';
          pptx.title = input.title;

          const brandColors: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
            ndmo: { primary: '0f2744', secondary: 'd4af37', accent: '1a73e8', bg: 'FFFFFF' },
            sdaia: { primary: '1a73e8', secondary: '374151', accent: '0CAB8F', bg: 'FFFFFF' },
            modern: { primary: '6366f1', secondary: '8b5cf6', accent: 'ec4899', bg: 'FFFFFF' },
            minimal: { primary: '1f2937', secondary: '6b7280', accent: '3b82f6', bg: 'FFFFFF' },
            custom: { primary: '0f2744', secondary: '374151', accent: '0CAB8F', bg: 'FFFFFF' },
          };
          const colors = brandColors[input.brandId] || brandColors.ndmo;

          for (const slide of input.slides) {
            const s = pptx.addSlide();
            s.background = { color: colors.bg };

            if (slide.layout === 'title' || slide.layout === 'closing') {
              s.background = { color: colors.primary };
              s.addText(slide.title || '', { x: 0.5, y: 1.5, w: 9, h: 1.5, fontSize: 36, color: 'FFFFFF', fontFace: 'Arial', align: 'right', rtlMode: true, bold: true });
              if (slide.subtitle) s.addText(slide.subtitle, { x: 0.5, y: 3.2, w: 9, h: 0.8, fontSize: 18, color: colors.secondary, fontFace: 'Arial', align: 'right', rtlMode: true });
            } else {
              // Header bar
              s.addShape('rect', { x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.primary } });
              s.addText(slide.title || '', { x: 0.3, y: 0.1, w: 9.4, h: 0.6, fontSize: 20, color: 'FFFFFF', fontFace: 'Arial', align: 'right', rtlMode: true, bold: true });

              // Content
              if (slide.content) {
                s.addText(slide.content, { x: 0.5, y: 1.0, w: 9, h: 1.2, fontSize: 12, color: '374151', fontFace: 'Arial', align: 'right', rtlMode: true, lineSpacingMultiple: 1.4 });
              }

              // Bullet points
              if (slide.bulletPoints && slide.bulletPoints.length > 0) {
                const startY = slide.content ? 2.4 : 1.2;
                const bullets = slide.bulletPoints.map((bp: string) => ({ text: bp, options: { fontSize: 11, color: '4b5563', bullet: { type: 'bullet' as const }, rtlMode: true, lineSpacingMultiple: 1.3 } }));
                s.addText(bullets, { x: 0.5, y: startY, w: 9, h: 3.5, fontFace: 'Arial', align: 'right', rtlMode: true, valign: 'top' });
              }

              // Charts
              if (slide.layout === 'chart' && slide.chartData?.length > 0) {
                const chartType = slide.chartType === 'line' ? pptx.ChartType.line : slide.chartType === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar;
                s.addChart(chartType, [{ name: slide.title || 'بيانات', labels: slide.chartLabels || [], values: slide.chartData }], { x: 1, y: 2.5, w: 8, h: 4, showLegend: true, showTitle: false, catAxisOrientation: 'minMax' });
              }

              // Tables
              if (slide.layout === 'table' && slide.tableHeaders?.length > 0) {
                const headerRow = slide.tableHeaders.map((h: string) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: colors.primary }, fontSize: 10, fontFace: 'Arial', align: 'right' as const } }));
                const dataRows = (slide.tableRows || []).map((row: string[]) => row.map((cell: string) => ({ text: cell, options: { fontSize: 9, fontFace: 'Arial', align: 'right' as const, border: { type: 'solid' as const, pt: 0.5, color: 'D1D5DB' } } })));
                s.addTable([headerRow, ...dataRows], { x: 0.5, y: 2.2, w: 9, colW: Array(slide.tableHeaders.length).fill(9 / slide.tableHeaders.length), fontSize: 10, align: 'right' as any });
              }
            }
          }

          const fileName = `presentation-${Date.now()}.pptx`;
          const fs = await import('fs');
          const path = await import('path');
          const outputDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
          const outputPath = path.join(outputDir, fileName);
          await pptx.writeFile({ fileName: outputPath });

          return { url: `/uploads/${fileName}`, format: 'pptx', fileName, success: true };
        } catch (err: any) {
          return { url: '', format: 'pptx', fileName: '', success: false, error: err.message };
        }
      }

      // HTML/PDF fallback
      return { url: '', format: input.format, fileName: '', success: false, error: 'Only PPTX export is currently supported' };
    }),

  // ─── List Templates ───────────────────────────────────────────
  listTemplates: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      scope: z.string().optional(),
    }))
    .query(({ input }) => {
      const templates = [
        { id: 'ndmo-official', name: 'مكتب إدارة البيانات الوطنية', category: 'official', scope: 'organization', brandId: 'ndmo', colors: { primary: '#0f2744', secondary: '#d4af37', accent: '#1a73e8' }, font: 'DIN Next Arabic', preview: '/assets/templates/ndmo.png' },
        { id: 'sdaia-official', name: 'سدايا — الهيئة السعودية للبيانات والذكاء الاصطناعي', category: 'official', scope: 'organization', brandId: 'sdaia', colors: { primary: '#1a73e8', secondary: '#374151', accent: '#0CAB8F' }, font: 'Helvetica Neue Arabic', preview: '/assets/templates/sdaia.png' },
        { id: 'modern-pro', name: 'عصري احترافي', category: 'corporate', scope: 'organization', brandId: 'modern', colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899' }, font: 'Tajawal', preview: '/assets/templates/modern.png' },
        { id: 'minimal-clean', name: 'بسيط ونظيف', category: 'minimal', scope: 'organization', brandId: 'minimal', colors: { primary: '#1f2937', secondary: '#6b7280', accent: '#3b82f6' }, font: 'Tajawal', preview: '/assets/templates/minimal.png' },
        { id: 'creative-bold', name: 'إبداعي جريء', category: 'creative', scope: 'organization', brandId: 'custom', colors: { primary: '#dc2626', secondary: '#f59e0b', accent: '#10b981' }, font: 'Tajawal', preview: '/assets/templates/creative.png' },
        { id: 'government-formal', name: 'حكومي رسمي', category: 'official', scope: 'organization', brandId: 'ndmo', colors: { primary: '#1e3a5f', secondary: '#c5a55a', accent: '#2d7d9a' }, font: 'DIN Next Arabic', preview: '/assets/templates/government.png' },
      ];

      let filtered = templates;
      if (input.category) filtered = filtered.filter(t => t.category === input.category);
      if (input.scope) filtered = filtered.filter(t => t.scope === input.scope);
      return { templates: filtered };
    }),

  // ═══════════════════════════════════════════════════════════════
  // Strict Replication Engine — Image → Live Editable Artifact
  // ═══════════════════════════════════════════════════════════════

  replicateFromImage: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      targetType: z.enum(['dashboard', 'presentation', 'report', 'spreadsheet']),
      language: z.string().default('ar'),
      strictMode: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      // Convert local file path to base64 data URI for OpenAI
      let imageUrl = input.imageUrl;
      if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
        const fs = await import('fs');
        const path = await import('path');
        const localPath = path.join(process.cwd(), imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl);
        if (fs.existsSync(localPath)) {
          const buffer = fs.readFileSync(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png';
          imageUrl = `data:${mime};base64,${buffer.toString('base64')}`;
        }
      }

      // Step 1: Send image to GPT-4o Vision for full structural analysis
      const visionPrompt = buildVisionPrompt(input.targetType, input.language);

      const visionMessages: VisionMessage[] = [
        {
          role: 'system',
          content: visionPrompt,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `حلل هذه الصورة وأرجع JSON كامل بكل العناصر المرئية بدقة 100%. النوع المستهدف: ${input.targetType}` },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ];

      const visionResult = await callVision(visionMessages, {
        model: 'gpt-4.1-mini',
        temperature: 0.1,
        max_tokens: 16000,
      });

      // Step 2: Parse the CDR from vision response
      let cdr: any;
      try {
        const jsonMatch = visionResult.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                          visionResult.content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : visionResult.content;
        cdr = JSON.parse(jsonStr);
      } catch {
        // If JSON parsing fails, ask GPT to convert to JSON
        const fixMessages: ChatMessage[] = [
          { role: 'system', content: 'حوّل النص التالي إلى JSON صالح. أجب بـ JSON فقط بدون أي نص آخر.' },
          { role: 'user', content: visionResult.content },
        ];
        const fixResult = await callAI(fixMessages, { temperature: 0, max_tokens: 16000 });
        try {
          const fixMatch = fixResult.content.match(/\{[\s\S]*\}/);
          cdr = JSON.parse(fixMatch ? fixMatch[0] : fixResult.content);
        } catch {
          return {
            success: false as const,
            error: 'فشل في تحليل الصورة. يرجى المحاولة بصورة أوضح.',
            raw: visionResult.content,
          };
        }
      }

      // Step 3: Build the target artifact from CDR
      const artifact = buildArtifactFromCDR(cdr, input.targetType, input.language);

      // Step 4: Generate evidence
      const evidence = {
        source_image: input.imageUrl.substring(0, 100) + '...',
        target_type: input.targetType,
        elements_detected: cdr.elements?.length || cdr.widgets?.length || cdr.slides?.length || cdr.sheets?.length || 0,
        colors_extracted: cdr.theme?.colors || cdr.colors || [],
        strict_mode: input.strictMode,
        vision_model: 'gpt-4.1-mini',
        analysis_timestamp: new Date().toISOString(),
      };

      return {
        success: true as const,
        targetType: input.targetType,
        cdr,
        artifact,
        evidence,
        elementCount: evidence.elements_detected,
      };
    }),

  replicateAndSave: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      targetType: z.enum(['dashboard', 'presentation', 'report', 'spreadsheet']),
      language: z.string().default('ar'),
      title: z.string().default(''),
    }))
    .mutation(async ({ input }) => {
      // Convert local path to base64
      let imageUrl = input.imageUrl;
      if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
        const fs = await import('fs');
        const path = await import('path');
        const localPath = path.join(process.cwd(), imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl);
        if (fs.existsSync(localPath)) {
          const buffer = fs.readFileSync(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
          imageUrl = `data:${mime};base64,${buffer.toString('base64')}`;
        }
      }

      const visionPrompt = buildVisionPrompt(input.targetType, input.language);
      const visionMessages: VisionMessage[] = [
        { role: 'system', content: visionPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `حلل هذه الصورة واستخرج كل العناصر بدقة 100%. النوع: ${input.targetType}` },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ];

      const visionResult = await callVision(visionMessages, {
        model: 'gpt-4.1-mini',
        temperature: 0.1,
        max_tokens: 16000,
      });

      let cdr: any;
      try {
        const jsonMatch = visionResult.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                          visionResult.content.match(/\{[\s\S]*\}/);
        cdr = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : visionResult.content);
      } catch {
        return { success: false as const, error: 'فشل في تحليل الصورة', targetType: input.targetType };
      }

      const artifact = buildArtifactFromCDR(cdr, input.targetType, input.language);
      const title = input.title || cdr.title || artifact.title;

      return {
        success: true as const,
        targetType: input.targetType,
        title,
        artifact,
        cdr,
        elementCount: cdr.widgets?.length || cdr.slides?.length || cdr.sections?.length || cdr.sheets?.length || 0,
        theme: cdr.theme || {},
        savedAt: new Date().toISOString(),
      };
    }),

  // ═══════════════════════════════════════════════════════════════
  // PDF → Multi-page Replication (50+ pages → 50+ slides/pages)
  // ═══════════════════════════════════════════════════════════════
  replicateFromPdf: publicProcedure
    .input(z.object({
      filePath: z.string(), // Path to uploaded PDF file
      targetType: z.enum(['presentation', 'report', 'spreadsheet']).default('presentation'),
      language: z.string().default('ar'),
      pageRange: z.object({
        start: z.number().int().min(1).default(1),
        end: z.number().int().optional(), // undefined = all pages
      }).optional(),
      batchSize: z.number().int().min(1).max(10).default(5), // Pages per AI call
    }))
    .mutation(async ({ input }) => {
      const fs = await import('fs');
      const path = await import('path');

      const pdfPath = input.filePath.startsWith('/')
        ? path.join(process.cwd(), input.filePath)
        : input.filePath;

      if (!fs.existsSync(pdfPath)) {
        return { success: false as const, error: `ملف PDF غير موجود: ${input.filePath}`, pages: [], totalPages: 0 };
      }

      // Step 1: Convert PDF pages to images using pdf-parse + canvas OR just send to Vision
      // Since GPT-4o can read PDFs as images, we convert each page to base64
      const pdfBuffer = fs.readFileSync(pdfPath);
      const base64Pdf = pdfBuffer.toString('base64');

      // Step 2: First pass — get total page count and overview
      const overviewMessages: VisionMessage[] = [
        {
          role: 'system',
          content: `أنت محلل مستندات PDF. مهمتك:
1. حدد عدد الصفحات الإجمالي
2. حدد نوع المحتوى في كل صفحة (غلاف، نص، جدول، رسم بياني، إنفوجرافيك، صور)
3. استخرج الثيم العام (الألوان والخطوط)

أجب بـ JSON:
{
  "totalPages": number,
  "title": "عنوان المستند",
  "theme": { "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "backgroundColor": "#hex", "fontFamily": "الخط" },
  "pageMap": [
    { "page": 1, "type": "cover | content | table | chart | infographic | mixed", "title": "عنوان الصفحة" }
  ]
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'حلل هذا المستند وأعطني خريطة الصفحات والثيم العام' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}`, detail: 'low' } },
          ],
        },
      ];

      let overview: any = { totalPages: 1, title: 'مستند', theme: {}, pageMap: [] };
      try {
        const overviewResult = await callVision(overviewMessages, { model: 'gpt-4.1-mini', temperature: 0.1, max_tokens: 4000 });
        const jsonMatch = overviewResult.content.match(/```json\s*([\s\S]*?)\s*```/) || overviewResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) overview = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch { /* use defaults */ }

      const totalPages = overview.totalPages || 1;
      const startPage = input.pageRange?.start || 1;
      const endPage = Math.min(input.pageRange?.end || totalPages, totalPages);
      const pagesToProcess = endPage - startPage + 1;

      // Step 3: Process pages in batches — each batch sent to GPT-4o Vision
      const allPages: any[] = [];
      const batchSize = input.batchSize;

      for (let batchStart = startPage; batchStart <= endPage; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, endPage);
        const pageNumbers = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

        const targetPrompt = input.targetType === 'presentation'
          ? `حوّل كل صفحة إلى شريحة عرض تقديمي. كل صفحة = شريحة واحدة.
أرجع JSON: { "slides": [ { "pageNumber": N, "layout": "title|content|chart|table|infographic|two-column|kpi|timeline|closing", "title": "...", "subtitle": "...", "content": "فقرة كاملة 60+ كلمة", "bulletPoints": ["نقطة1", "نقطة2"], "notes": "ملاحظات 50+ كلمة", "chartType": "bar|line|pie", "chartData": [N], "chartLabels": ["..."], "chartColors": ["#hex"], "tableHeaders": ["..."], "tableRows": [["..."]], "infographicItems": [{"icon":"...", "label":"...", "value":"..."}], "timelineItems": [{"year":"...", "title":"...", "description":"..."}], "style": {"backgroundColor":"#hex", "titleColor":"#hex"} } ] }`
          : input.targetType === 'report'
          ? `حوّل كل صفحة إلى قسم تقرير. كل صفحة = قسم واحد.
أرجع JSON: { "sections": [ { "pageNumber": N, "type": "cover|heading|paragraph|kpi|chart|table|recommendation|executive-summary", "title": "...", "content": "محتوى كامل", "level": 1, "data": { "kpis": [], "chartType": "", "chartData": [], "chartLabels": [], "headers": [], "rows": [[]], "items": [] } } ] }`
          : `حوّل كل صفحة إلى ورقة جدول. كل جدول في صفحة = ورقة.
أرجع JSON: { "sheets": [ { "pageNumber": N, "name": "...", "headers": ["..."], "rows": [["..."]], "formulas": [] } ] }`;

        const batchMessages: VisionMessage[] = [
          {
            role: 'system',
            content: `أنت محرك مطابقة بصرية. حلل صفحات PDF (${pageNumbers.join(',')}) من أصل ${totalPages} صفحة.
استخرج كل عنصر بدقة 100%: نصوص حرفية، أرقام بالضبط، ألوان hex، هيكل الجداول والرسوم.
${targetPrompt}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `حلل الصفحات ${pageNumbers.join(',')} من هذا المستند واستخرج كل التفاصيل` },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}`, detail: 'high' } },
            ],
          },
        ];

        try {
          const batchResult = await callVision(batchMessages, {
            model: 'gpt-4.1-mini',
            temperature: 0.1,
            max_tokens: 16000,
          });

          const jsonMatch = batchResult.content.match(/```json\s*([\s\S]*?)\s*```/) || batchResult.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            const items = parsed.slides || parsed.sections || parsed.sheets || [];
            allPages.push(...items);
          }
        } catch (err) {
          // Add placeholder for failed batch
          for (const pn of pageNumbers) {
            allPages.push({
              pageNumber: pn,
              title: `صفحة ${pn} — فشل التحليل`,
              content: 'تعذر تحليل هذه الصفحة. يرجى المحاولة مرة أخرى.',
              layout: 'content',
              type: 'paragraph',
              name: `صفحة ${pn}`,
            });
          }
        }
      }

      // Step 4: Build final artifact
      const artifact: any = {
        title: overview.title || 'مستند محوّل',
        theme: overview.theme || {},
        totalSourcePages: totalPages,
        processedPages: allPages.length,
      };

      if (input.targetType === 'presentation') {
        artifact.type = 'presentation';
        artifact.slides = JSON.stringify(allPages);
        artifact.description = `عرض تقديمي من ${allPages.length} شريحة — محوّل من PDF (${totalPages} صفحة)`;
      } else if (input.targetType === 'report') {
        artifact.type = 'report';
        artifact.reportType = 'extracted';
        artifact.sections = JSON.stringify(allPages);
        artifact.description = `تقرير من ${allPages.length} قسم — محوّل من PDF (${totalPages} صفحة)`;
      } else {
        artifact.type = 'spreadsheet';
        artifact.sheets = JSON.stringify(allPages);
        artifact.description = `جدول من ${allPages.length} ورقة — محوّل من PDF (${totalPages} صفحة)`;
      }

      return {
        success: true as const,
        targetType: input.targetType,
        title: overview.title || 'مستند محوّل',
        theme: overview.theme || {},
        totalSourcePages: totalPages,
        processedPages: allPages.length,
        pageRange: { start: startPage, end: endPage },
        artifact,
        pageMap: overview.pageMap || [],
      };
    }),

  // ─── Speech-to-Text (Whisper) ────────────────────────────────
  speechToText: publicProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string().default('audio/webm') }))
    .mutation(async ({ input }) => {
      const apiKey = ENV.openaiApiKey;
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for STT');
      const OPENAI_BASE = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
      // Convert base64 to buffer
      const buffer = Buffer.from(input.audioBase64, 'base64');
      const blob = new Blob([buffer], { type: input.mimeType });
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ar');
      formData.append('response_format', 'json');
      const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`STT error ${response.status}: ${err}`);
      }
      const data = await response.json() as { text: string };
      return { text: data.text || '' };
    }),

  // ─── Text-to-Speech ─────────────────────────────────────────
  textToSpeech: publicProcedure
    .input(z.object({ text: z.string().max(4096), voice: z.string().default('alloy') }))
    .mutation(async ({ input }) => {
      const apiKey = ENV.openaiApiKey;
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for TTS');
      const OPENAI_BASE = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
      const response = await fetch(`${OPENAI_BASE}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: input.text,
          voice: input.voice,
          response_format: 'mp3',
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`TTS error ${response.status}: ${err}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return { audioBase64: base64, mimeType: 'audio/mpeg' };
    }),
});
