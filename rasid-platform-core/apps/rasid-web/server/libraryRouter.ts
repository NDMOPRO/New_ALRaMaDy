import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import JSZip from "jszip";
import { protectedProcedure, publicProcedure } from "./_core/trpc";
import { router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  slideTemplates,
  slideElements,
  elementCategories,
  elementUsageRules,
} from "../drizzle/schema";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

// ─── Default Categories (seeded on first use) ────────────────────

const DEFAULT_CATEGORIES = [
  { slug: "kpi_card", nameAr: "بطاقة مؤشر أداء", nameEn: "KPI Card", icon: "speed", description: "Large numbers with labels, trends, and icons for key performance indicators" },
  { slug: "colored_pillars", nameAr: "أعمدة ملونة", nameEn: "Colored Pillars", icon: "view_column", description: "3-4 column layout with colored headers, icons, and content sections" },
  { slug: "data_table", nameAr: "جدول بيانات", nameEn: "Data Table", icon: "table_chart", description: "Professional tables with colored headers, status badges, and alternating rows" },
  { slug: "horizontal_bars", nameAr: "أشرطة أفقية", nameEn: "Horizontal Bars", icon: "bar_chart", description: "Horizontal bar charts with labels, percentages, and colored bars" },
  { slug: "process_flow", nameAr: "تدفق عمليات", nameEn: "Process Flow", icon: "account_tree", description: "Numbered steps with descriptions, SLA badges, and flow arrows" },
  { slug: "card_grid", nameAr: "شبكة بطاقات", nameEn: "Card Grid", icon: "grid_view", description: "2x3 or 3x2 grid of cards with borders, icons, and descriptions" },
  { slug: "comparison", nameAr: "مقارنة", nameEn: "Comparison", icon: "compare", description: "In/Out scope or before/after comparison with check/cross icons" },
  { slug: "circular_gauge", nameAr: "مقياس دائري", nameEn: "Circular Gauge", icon: "donut_large", description: "Ring chart showing score/maturity with dimension bars below" },
  { slug: "timeline", nameAr: "جدول زمني", nameEn: "Timeline", icon: "timeline", description: "Horizontal or vertical timeline with milestones and dates" },
  { slug: "risk_matrix", nameAr: "مصفوفة مخاطر", nameEn: "Risk Matrix", icon: "warning", description: "Risk cards with severity levels and colored borders" },
  { slug: "governance_pyramid", nameAr: "هرم حوكمة", nameEn: "Governance Pyramid", icon: "filter_list", description: "Stacked colored layers showing hierarchy levels" },
  { slug: "project_card", nameAr: "بطاقة مشروع", nameEn: "Project Card", icon: "assignment", description: "Multi-section card with metadata, objectives, KPIs, and timeline" },
  { slug: "authority_matrix", nameAr: "مصفوفة صلاحيات", nameEn: "Authority Matrix", icon: "admin_panel_settings", description: "Authority levels with roles, limits, and descriptions" },
  { slug: "classification_grid", nameAr: "شبكة تصنيف", nameEn: "Classification Grid", icon: "category", description: "Multi-section grid with colored classification badges" },
  { slug: "cover_slide", nameAr: "شريحة غلاف", nameEn: "Cover Slide", icon: "image", description: "Title slide with background, logos, and subtitle" },
  { slug: "section_divider", nameAr: "فاصل أقسام", nameEn: "Section Divider", icon: "horizontal_rule", description: "Section separator with large title and icon" },
  { slug: "closing_slide", nameAr: "شريحة ختام", nameEn: "Closing Slide", icon: "check_circle", description: "Thank you / closing slide with contact info and logos" },
  { slug: "infographic", nameAr: "إنفوجرافيك", nameEn: "Infographic", icon: "insights", description: "Visual data representation with icons, numbers, and illustrations" },
  { slug: "org_chart", nameAr: "هيكل تنظيمي", nameEn: "Org Chart", icon: "account_tree", description: "Organizational structure with roles and reporting lines" },
  { slug: "scope_definition", nameAr: "تعريف النطاق", nameEn: "Scope Definition", icon: "crop_free", description: "Scope cards with timeline, geography, entities, and data type" },
];

// ─── Helper: Seed default categories ─────────────────────────────

async function ensureDefaultCategories() {
  const db = await getDb();
  if (!db) return;
  
  const existing = await db.select().from(elementCategories);
  if (existing.length > 0) return;
  
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    await db.insert(elementCategories).values({
      slug: cat.slug,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      description: cat.description,
      icon: cat.icon,
      sortOrder: i,
    });
  }
}

// ─── PPTX Parser ─────────────────────────────────────────────────

interface ParsedSlide {
  slideNumber: number;
  title: string;
  texts: string[];
  hasChart: boolean;
  hasTable: boolean;
  hasImage: boolean;
  shapeCount: number;
  textBlockCount: number;
  rawXml: string;
}

async function parsePptxBuffer(buffer: Buffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slides: ParsedSlide[] = [];
  
  // Find all slide XML files
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });
  
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    const slideNum = parseInt(slideFile.match(/slide(\d+)/)?.[1] || "0");
    
    // Extract text content
    const texts: string[] = [];
    const textRegex = /<a:t[^>]*>([^<]+)<\/a:t>/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(xml)) !== null) {
      if (textMatch[1].trim()) texts.push(textMatch[1].trim());
    }
    
    // Detect element types
    const hasChart = xml.includes("c:chart") || xml.includes("chartSpace");
    const hasTable = xml.includes("<a:tbl>") || xml.includes("<a:tbl ");
    const hasImage = xml.includes("<p:pic>") || xml.includes("r:embed");
    const shapeCount = (xml.match(/<p:sp>/g) || []).length;
    const textBlockCount = (xml.match(/<p:txBody>/g) || []).length;
    
    // Extract title (usually the first large text)
    const title = texts[0] || `شريحة ${slideNum}`;
    
    slides.push({
      slideNumber: slideNum,
      title,
      texts,
      hasChart,
      hasTable,
      hasImage,
      shapeCount,
      textBlockCount,
      rawXml: xml,
    });
  }
  
  return slides;
}

// ─── AI-Powered Element Decomposition ───────────────────────────
// Decomposes a single slide into MULTIPLE individual elements
// (e.g., a slide with a table + chart = 2 separate elements)

interface DecomposedElement {
  categorySlug: string;
  elementName: string;
  description: string;
  elementType: string; // 'table' | 'chart' | 'kpi_card' | 'infographic' | 'text_block' | 'process_flow' | 'matrix' | 'timeline' | 'cover' | 'comparison' | 'org_chart' | 'gauge'
  designTemplate: {
    layout: string;
    columns: number;
    rows: number;
    colorScheme: string[];
    typography: { headingSize: number; bodySize: number; fontWeight: string };
    spacing: { padding: number; gap: number; borderRadius: number };
    borders: { width: number; color: string; style: string };
    background: { type: string; color: string; gradient?: string };
    elements: string[];
    sampleData: any; // Sample data structure for preview rendering
  };
  contentSlots: { name: string; type: string; required: boolean }[];
  usageContexts: string[];
  sampleTexts: string[];
}

async function decomposeSlideToElements(
  slide: ParsedSlide,
  categories: { id: number; slug: string; nameAr: string }[]
): Promise<DecomposedElement[]> {
  const categoryList = categories.map(c => `${c.slug}: ${c.nameAr}`).join("\n");

  const prompt = `حلل هذه الشريحة من عرض تقديمي وفكّكها إلى عناصر تصميم فردية.

معلومات الشريحة:
- رقم الشريحة: ${slide.slideNumber}
- العنوان: ${slide.title}
- النصوص: ${slide.texts.slice(0, 30).join(" | ")}
- يحتوي رسم بياني: ${slide.hasChart ? "نعم" : "لا"}
- يحتوي جدول: ${slide.hasTable ? "نعم" : "لا"}
- يحتوي صور: ${slide.hasImage ? "نعم" : "لا"}
- عدد الأشكال: ${slide.shapeCount}
- عدد كتل النص: ${slide.textBlockCount}

الفئات المتاحة:
${categoryList}

المطلوب: فكّك الشريحة إلى عناصر فردية مستقلة. مثلاً:
- إذا كانت الشريحة تحتوي جدول + رسم بياني = عنصران منفصلان
- إذا كانت تحتوي 4 بطاقات KPI = عنصر واحد من نوع kpi_card
- إذا كانت تحتوي إنفوجرافيك + نص = عنصران
- الغلاف = عنصر واحد من نوع cover

لكل عنصر، أعطِ:
1. اسم وصفي دقيق
2. وصف تفصيلي لشكل العنصر وألوانه وتخطيطه
3. بيانات نموذجية (sampleData) تمثل شكل العنصر للمعاينة البصرية
4. ألوان حقيقية من التصميم (ليس فقط #003366)`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت خبير تفكيك عروض تقديمية. مهمتك تحليل شريحة واحدة واستخراج كل عنصر تصميم فردي منها.

قواعد مهمة:
- كل مكوّن بصري مستقل = عنصر منفصل (جدول، رسم بياني، بطاقات KPI، إنفوجرافيك، مصفوفة، إلخ)
- لا تجمع عناصر مختلفة في عنصر واحد
- أعطِ ألوان حقيقية متنوعة (ليس فقط #003366)
- أعطِ sampleData حقيقية تمثل شكل العنصر
- الوصف يجب أن يكون تفصيلياً يصف الشكل البصري بدقة

أجب بـ JSON array فقط.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "slide_decomposition",
          strict: true,
          schema: {
            type: "object",
            properties: {
              elements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    categorySlug: { type: "string" },
                    elementName: { type: "string" },
                    description: { type: "string" },
                    elementType: { type: "string" },
                    designTemplate: {
                      type: "object",
                      properties: {
                        layout: { type: "string" },
                        columns: { type: "number" },
                        rows: { type: "number" },
                        colorScheme: { type: "array", items: { type: "string" } },
                        typography: {
                          type: "object",
                          properties: {
                            headingSize: { type: "number" },
                            bodySize: { type: "number" },
                            fontWeight: { type: "string" },
                          },
                          required: ["headingSize", "bodySize", "fontWeight"],
                          additionalProperties: false,
                        },
                        spacing: {
                          type: "object",
                          properties: {
                            padding: { type: "number" },
                            gap: { type: "number" },
                            borderRadius: { type: "number" },
                          },
                          required: ["padding", "gap", "borderRadius"],
                          additionalProperties: false,
                        },
                        borders: {
                          type: "object",
                          properties: {
                            width: { type: "number" },
                            color: { type: "string" },
                            style: { type: "string" },
                          },
                          required: ["width", "color", "style"],
                          additionalProperties: false,
                        },
                        background: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            color: { type: "string" },
                            gradient: { type: "string" },
                          },
                          required: ["type", "color", "gradient"],
                          additionalProperties: false,
                        },
                        elements: { type: "array", items: { type: "string" } },
                        sampleData: {
                          type: "object",
                          properties: {
                            headers: { type: "array", items: { type: "string" } },
                            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                            labels: { type: "array", items: { type: "string" } },
                            values: { type: "array", items: { type: "number" } },
                            items: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, icon: { type: "string" }, color: { type: "string" } }, required: ["label", "value", "icon", "color"], additionalProperties: false } },
                            title: { type: "string" },
                            subtitle: { type: "string" },
                          },
                          required: ["headers", "rows", "labels", "values", "items", "title", "subtitle"],
                          additionalProperties: false,
                        },
                      },
                      required: ["layout", "columns", "rows", "colorScheme", "typography", "spacing", "borders", "background", "elements", "sampleData"],
                      additionalProperties: false,
                    },
                    contentSlots: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string" },
                          required: { type: "boolean" },
                        },
                        required: ["name", "type", "required"],
                        additionalProperties: false,
                      },
                    },
                    usageContexts: { type: "array", items: { type: "string" } },
                    sampleTexts: { type: "array", items: { type: "string" } },
                  },
                  required: ["categorySlug", "elementName", "description", "elementType", "designTemplate", "contentSlots", "usageContexts", "sampleTexts"],
                  additionalProperties: false,
                },
              },
            },
            required: ["elements"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0].message.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content) || '{}');
    return parsed.elements || [];
  } catch (e) {
    console.error("AI decomposition failed for slide:", slide.slideNumber, e);
    // Fallback: create one element per slide
    return [{
      categorySlug: slide.hasTable ? "data_table" : slide.hasChart ? "horizontal_bars" : "infographic",
      elementName: slide.title,
      description: `عنصر مستخرج من شريحة ${slide.slideNumber}: ${slide.texts.slice(0, 3).join(" - ")}`,
      elementType: slide.hasTable ? "table" : slide.hasChart ? "chart" : "text_block",
      designTemplate: {
        layout: "mixed", columns: 1, rows: 1,
        colorScheme: ["#0f2744", "#1a5276", "#2980b9", "#d4af37", "#27ae60"],
        typography: { headingSize: 24, bodySize: 14, fontWeight: "bold" },
        spacing: { padding: 16, gap: 12, borderRadius: 8 },
        borders: { width: 1, color: "#e0e0e0", style: "solid" },
        background: { type: "solid", color: "#ffffff", gradient: "" },
        elements: ["content"],
        sampleData: { headers: [], rows: [], labels: [], values: [], items: [], title: slide.title, subtitle: "" },
      },
      contentSlots: [{ name: "title", type: "text", required: true }],
      usageContexts: ["general"],
      sampleTexts: slide.texts.slice(0, 5),
    }];
  }
}

// ─── Library Router ──────────────────────────────────────────────

export const libraryRouter = router({
  // ─── Get all categories ────────────────────────────────────────
  getCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await ensureDefaultCategories();
    return db.select().from(elementCategories).orderBy(elementCategories.sortOrder);
  }),

  // ─── Get all templates ─────────────────────────────────────────
  getTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(slideTemplates).orderBy(desc(slideTemplates.createdAt));
  }),

  // ─── Get elements by category ──────────────────────────────────
  getElementsByCategory: publicProcedure
    .input(z.object({ categoryId: z.number().optional(), activeOnly: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      if (input.categoryId) conditions.push(eq(slideElements.categoryId, input.categoryId));
      if (input.activeOnly !== false) conditions.push(eq(slideElements.isActive, true));
      
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(slideElements).where(where).orderBy(desc(slideElements.qualityRating));
    }),

  // ─── Get all elements with categories ──────────────────────────
  getAllElements: publicProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const condition = input?.activeOnly !== false ? eq(slideElements.isActive, true) : undefined;
      
      const elements = await db.select().from(slideElements).where(condition).orderBy(desc(slideElements.qualityRating));
      const categories = await db.select().from(elementCategories);
      const rules = await db.select().from(elementUsageRules);
      
      return elements.map(el => ({
        ...el,
        category: categories.find(c => c.id === el.categoryId),
        usageRules: rules.filter(r => r.elementId === el.id),
      }));
    }),

  // ─── Get elements for a specific trigger context (used by AI engine) ───
  getElementsForContext: publicProcedure
    .input(z.object({ triggerContext: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const matchingRules = await db
        .select()
        .from(elementUsageRules)
        .where(and(
          eq(elementUsageRules.triggerContext, input.triggerContext),
          eq(elementUsageRules.isActive, true),
        ))
        .orderBy(desc(elementUsageRules.priority));
      
      if (matchingRules.length === 0) return [];
      
      const elementIds = matchingRules.map(r => r.elementId);
      const elements = await db
        .select()
        .from(slideElements)
        .where(and(
          eq(slideElements.isActive, true),
          sql`${slideElements.id} IN (${sql.join(elementIds.map(id => sql`${id}`), sql`, `)})`
        ));
      
      return elements;
    }),

  // ─── Upload and process a PPTX template ────────────────────────
  uploadTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      await ensureDefaultCategories();
      
      // Upload PPTX to S3
      const buffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `library/templates/${Date.now()}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      
      // Create template record
      const [inserted] = await db.insert(slideTemplates).values({
        name: input.name,
        description: input.description || null,
        fileUrl,
        fileKey,
        status: "processing",
        uploadedBy: ctx.user.id,
      }).$returningId();
      
      const templateId = inserted.id;
      
      // Parse PPTX in background
      try {
        const parsedSlides = await parsePptxBuffer(buffer);
        
        // Get categories for AI classification
        const categories = await db.select().from(elementCategories);
        
        let elementCount = 0;
        
        for (const slide of parsedSlides) {
          // Decompose each slide into individual elements
          const decomposedElements = await decomposeSlideToElements(slide, categories);
          
          for (const elem of decomposedElements) {
            // Find matching category
            const category = categories.find(c => c.slug === elem.categorySlug);
            
            // Insert element with rich design data
            const [elementInserted] = await db.insert(slideElements).values({
              templateId,
              categoryId: category?.id || null,
              name: elem.elementName,
              description: elem.description,
              sourceSlideNumber: slide.slideNumber,
              designTemplate: elem.designTemplate,
              styleProperties: {
                elementType: elem.elementType,
                texts: elem.sampleTexts,
                sampleData: elem.designTemplate.sampleData,
              },
              contentSlots: elem.contentSlots,
              isActive: true,
              qualityRating: 3,
            }).$returningId();
            
            // Insert usage rules
            for (const context of elem.usageContexts) {
              await db.insert(elementUsageRules).values({
                elementId: elementInserted.id,
                triggerContext: context,
                ruleDescription: `استخدم عند عرض ${context}`,
                priority: 5,
                isActive: true,
              });
            }
            
            elementCount++;
          }
        }
        
        // Update template status
        await db.update(slideTemplates)
          .set({ status: "ready", slideCount: parsedSlides.length, elementCount })
          .where(eq(slideTemplates.id, templateId));
        
        return { templateId, slideCount: parsedSlides.length, elementCount, status: "ready" };
      } catch (error: any) {
        await db.update(slideTemplates)
          .set({ status: "failed", errorMessage: error.message })
          .where(eq(slideTemplates.id, templateId));
        
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to process PPTX: ${error.message}` });
      }
    }),

  // ─── Update element (admin) ────────────────────────────────────
  updateElement: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      isActive: z.boolean().optional(),
      qualityRating: z.number().min(1).max(5).optional(),
      htmlTemplate: z.string().optional(),
      designTemplate: z.any().optional(),
      styleProperties: z.any().optional(),
      contentSlots: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const updateSet: Record<string, any> = {};
      if (input.name !== undefined) updateSet.name = input.name;
      if (input.description !== undefined) updateSet.description = input.description;
      if (input.categoryId !== undefined) updateSet.categoryId = input.categoryId;
      if (input.isActive !== undefined) updateSet.isActive = input.isActive;
      if (input.qualityRating !== undefined) updateSet.qualityRating = input.qualityRating;
      if (input.htmlTemplate !== undefined) updateSet.htmlTemplate = input.htmlTemplate;
      if (input.designTemplate !== undefined) updateSet.designTemplate = input.designTemplate;
      if (input.styleProperties !== undefined) updateSet.styleProperties = input.styleProperties;
      if (input.contentSlots !== undefined) updateSet.contentSlots = input.contentSlots;
      
      await db.update(slideElements).set(updateSet).where(eq(slideElements.id, input.id));
      return { success: true };
    }),

  // ─── Update usage rules for an element ─────────────────────────
  updateUsageRules: protectedProcedure
    .input(z.object({
      elementId: z.number(),
      rules: z.array(z.object({
        triggerContext: z.string(),
        ruleDescription: z.string().optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Delete existing rules
      await db.delete(elementUsageRules).where(eq(elementUsageRules.elementId, input.elementId));
      
      // Insert new rules
      for (const rule of input.rules) {
        await db.insert(elementUsageRules).values({
          elementId: input.elementId,
          triggerContext: rule.triggerContext,
          ruleDescription: rule.ruleDescription || `استخدم عند عرض ${rule.triggerContext}`,
          priority: rule.priority || 5,
          isActive: rule.isActive !== false,
        });
      }
      
      return { success: true };
    }),

  // ─── Delete template and its elements ──────────────────────────
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Get elements for this template
      const elements = await db.select().from(slideElements).where(eq(slideElements.templateId, input.id));
      
      // Delete usage rules for each element
      for (const el of elements) {
        await db.delete(elementUsageRules).where(eq(elementUsageRules.elementId, el.id));
      }
      
      // Delete elements
      await db.delete(slideElements).where(eq(slideElements.templateId, input.id));
      
      // Delete template
      await db.delete(slideTemplates).where(eq(slideTemplates.id, input.id));
      
      return { success: true };
    }),

  // ─── Create new element (admin) ────────────────────────────────
  createElement: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      htmlTemplate: z.string().optional(),
      designTemplate: z.any().optional(),
      styleProperties: z.any().optional(),
      contentSlots: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      await ensureDefaultCategories();
      
      const [inserted] = await db.insert(slideElements).values({
        name: input.name,
        description: input.description || null,
        categoryId: input.categoryId || null,
        htmlTemplate: input.htmlTemplate || null,
        designTemplate: input.designTemplate || null,
        styleProperties: input.styleProperties || null,
        contentSlots: input.contentSlots || null,
        isActive: true,
        qualityRating: 3,
      }).$returningId();
      
      return { id: inserted.id, success: true };
    }),

  // ─── Get single element by ID ──────────────────────────────────
  getElement: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [element] = await db.select().from(slideElements).where(eq(slideElements.id, input.id));
      if (!element) return null;
      
      const categories = await db.select().from(elementCategories);
      const rules = await db.select().from(elementUsageRules).where(eq(elementUsageRules.elementId, input.id));
      
      return {
        ...element,
        category: categories.find(c => c.id === element.categoryId),
        usageRules: rules,
      };
    }),

  // ─── Delete single element ─────────────────────────────────────
  deleteElement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      await db.delete(elementUsageRules).where(eq(elementUsageRules.elementId, input.id));
      await db.delete(slideElements).where(eq(slideElements.id, input.id));
      
      return { success: true };
    }),

  // ─── Convert HTML to template via AI ───────────────────────────
  convertPptxToHtml: protectedProcedure
    .input(z.object({
      slideDescription: z.string(),
      slideName: z.string(),
      categorySlug: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const messages = [
        {
          role: 'system' as const,
          content: `You are an expert HTML/CSS slide designer. Create a complete standalone HTML template for a presentation slide (1280x720 pixels).

Requirements:
- Complete HTML document with <!DOCTYPE html>, <html dir="rtl" lang="ar">
- Inline CSS (no external stylesheets except Google Fonts)
- Use Tajawal font from Google Fonts
- Professional NDMO-style design (dark navy #0f2744, gold #d4af37, teal #0CAB8F)
- All text in Arabic
- Include Chart.js from CDN if charts are needed
- The slide must be exactly 1280x720 pixels
- Use realistic sample data

Return ONLY the complete HTML code, nothing else.`,
        },
        {
          role: 'user' as const,
          content: `Create an HTML slide template for: ${input.slideName}\n\nDescription: ${input.slideDescription}\n\nCategory: ${input.categorySlug || 'general'}`,
        },
      ];
      
      const result = await invokeLLM({ messages, max_tokens: 8000 });
      let html = String(result.choices?.[0]?.message?.content || '');
      
      // Extract HTML if wrapped in code blocks
      const htmlMatch = html.match(/```html\n([\s\S]*?)\n```/);
      if (htmlMatch) html = htmlMatch[1];
      
      // Basic validation
      if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI did not generate valid HTML" });
      }
      
      return { html };
    }),

  // ─── Library stats ─────────────────────────────────────────────
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { templates: 0, elements: 0, categories: 0, activeElements: 0 };
    
    const [templates] = await db.select({ count: sql<number>`count(*)` }).from(slideTemplates);
    const [elements] = await db.select({ count: sql<number>`count(*)` }).from(slideElements);
    const [active] = await db.select({ count: sql<number>`count(*)` }).from(slideElements).where(eq(slideElements.isActive, true));
    const [cats] = await db.select({ count: sql<number>`count(*)` }).from(elementCategories);
    
    return {
      templates: Number(templates.count),
      elements: Number(elements.count),
      activeElements: Number(active.count),
      categories: Number(cats.count),
    };
  }),
});
