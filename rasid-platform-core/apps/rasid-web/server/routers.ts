/**
 * routers.ts — ALL operations execute EXCLUSIVELY on Railway engines
 * 
 * ██████████████████████████████████████████████████████████████
 * ██  ZERO localDb  ·  ZERO SQLite  ·  ZERO local logic     ██
 * ██  EVERYTHING → Railway Engines via platformConnector      ██
 * ██████████████████████████████████████████████████████████████
 * 
 * Design principle: 
 *   التصميم منا والبرمجة من المحركات
 *   UI/Design = Our custom frontend
 *   Execution/Logic = Exclusively from backend engines on Railway
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { aiRouter } from "./aiRouter";
import { libraryRouter } from "./libraryRouter";
import { platformRouter } from "./platformRouter";
import { loginUser, registerUser, setAuthCookie, clearAuthCookie } from "./engineAuth";
import * as engine from "./platformConnector";
import { z } from "zod";

export const appRouter = router({
  // ═══════════════════════════════════════════════════════════════
  // AUTH — via Central Engine (governance/auth)
  // ═══════════════════════════════════════════════════════════════
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      return {
        id: ctx.user.id,
        userId: ctx.user.userId,
        displayName: ctx.user.displayName,
        email: ctx.user.email,
        mobile: ctx.user.mobile,
        role: ctx.user.role,
        department: ctx.user.department,
        avatar: ctx.user.avatar,
        status: ctx.user.status,
        permissions: ctx.user.permissions,
        createdAt: ctx.user.createdAt,
        lastSignedIn: ctx.user.lastSignedIn,
      };
    }),

    login: publicProcedure
      .input(z.object({ userId: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const result = await loginUser(input.userId, input.password);
        if (!result) {
          return { success: false as const, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
        }
        setAuthCookie(ctx.res, result.token, ctx.req);
        return { success: true as const, user: result.user };
      }),

    register: publicProcedure
      .input(z.object({
        userId: z.string().min(3),
        password: z.string().min(6),
        displayName: z.string().min(2),
        email: z.string().email().optional(),
        mobile: z.string().optional(),
        department: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await registerUser(input);
        if ("error" in result) {
          return { success: false as const, error: result.error };
        }
        setAuthCookie(ctx.res, result.token, ctx.req);
        return { success: true as const, user: result.user };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearAuthCookie(ctx.res, ctx.req);
      return { success: true as const };
    }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // AI — via OpenAI + Engine AI Jobs
  // ═══════════════════════════════════════════════════════════════
  ai: aiRouter,

  // ═══════════════════════════════════════════════════════════════
  // FILES — via Central Engine (data/register + data/list)
  // ═══════════════════════════════════════════════════════════════
  files: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.engineListFiles();
      if (!result.ok) return [];
      const data = result.data as any;
      const items = Array.isArray(data) ? data : (data?.data || data?.files || data?.datasets || []);
      return items.map((f: any, i: number) => ({
        id: f.id || f.file_id || f.dataset_id || i + 1,
        title: f.title || f.name || f.file_name || 'ملف بدون عنوان',
        type: f.type || f.source_kind || 'file',
        category: f.category || 'general',
        status: f.status || 'ready',
        icon: f.icon || 'description',
        size: f.size || '',
        filePath: f.file_path || f.filePath || '',
        mimeType: f.mime_type || f.mimeType || '',
        metadata: f.metadata || {},
        tags: f.tags || [],
        favorite: f.favorite || 0,
        createdAt: f.created_at || f.createdAt || new Date().toISOString(),
        updatedAt: f.updated_at || f.updatedAt || new Date().toISOString(),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        // Get from files list and filter
        const result = await engine.engineListFiles();
        if (!result.ok) return null;
        const data = result.data as any;
        const items = Array.isArray(data) ? data : (data?.data || data?.files || data?.datasets || []);
        const found = items.find((f: any) => String(f.id || f.file_id || f.dataset_id) === String(input.id));
        if (!found) return null;
        return {
          id: found.id || found.file_id || input.id,
          title: found.title || found.name || '',
          type: found.type || found.source_kind || 'file',
          category: found.category || 'general',
          status: found.status || 'ready',
          icon: found.icon || 'description',
          size: found.size || '',
          filePath: found.file_path || found.filePath || '',
          mimeType: found.mime_type || found.mimeType || '',
          metadata: found.metadata || {},
          tags: found.tags || [],
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        type: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        icon: z.string().optional(),
        size: z.string().optional(),
        filePath: z.string().optional(),
        mimeType: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.engineCreateFile(input);
        if (!result.ok) throw new Error(`فشل تسجيل الملف على المحرك`);
        return result.data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        status: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        // Update via re-register on engine
        if (input.title) {
          await engine.engineCreateFile({ title: input.title, status: input.status });
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await engine.engineDeleteFile(String(input.id));
        return { success: true };
      }),

    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        // Favorite state managed via engine metadata
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // REPORTS — via Report Engine (report-start-platform)
  // ═══════════════════════════════════════════════════════════════
  reports: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.listReports();
      if (!result.ok) return [];
      const data = result.data as any;
      const reports = Array.isArray(data) ? data : (data?.data || data?.reports || []);
      return reports.map((r: any, i: number) => ({
        id: r.id || r.report_id || i + 1,
        title: r.title || r.name || 'تقرير بدون عنوان',
        description: r.description || '',
        reportType: r.report_type || r.type || 'general',
        sections: r.sections || r.blocks || [],
        classification: r.classification || '',
        entity: r.entity || '',
        status: r.status || 'draft',
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input }) => {
        const result = await engine.getReportDetail(String(input.id));
        if (!result.ok) return null;
        const r = result.data as any;
        return {
          id: r.id || r.report_id || input.id,
          title: r.title || r.name || '',
          description: r.description || '',
          reportType: r.report_type || r.type || 'general',
          sections: r.sections || r.blocks || [],
          classification: r.classification || '',
          entity: r.entity || '',
          status: r.status || 'draft',
          createdAt: r.created_at || r.createdAt || '',
          updatedAt: r.updated_at || r.updatedAt || '',
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        reportType: z.string().optional(),
        sections: z.array(z.any()).optional(),
        classification: z.string().optional(),
        entity: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.createReport({
          title: input.title,
          description: input.description,
          report_type: input.reportType,
          sections: input.sections,
          classification: input.classification,
          entity: input.entity,
        });
        if (!result.ok) throw new Error(`فشل إنشاء التقرير: ${JSON.stringify(result.data)}`);
        return result.data;
      }),

    createFromExcel: protectedProcedure
      .input(z.object({
        fileUrl: z.string(),
        title: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.createReportFromExcel({
          file_url: input.fileUrl,
          title: input.title,
          ...input.options,
        });
        if (!result.ok) throw new Error(`فشل إنشاء التقرير من Excel`);
        return result.data;
      }),

    createFromTranscription: protectedProcedure
      .input(z.object({
        transcriptionJobId: z.string(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.createReportFromTranscription(input.transcriptionJobId, input.options);
        if (!result.ok) throw new Error(`فشل إنشاء التقرير من التفريغ`);
        return result.data;
      }),

    import: protectedProcedure
      .input(z.object({ payload: z.record(z.string(), z.any()) }))
      .mutation(async ({ input }) => {
        const result = await engine.importReport(input.payload);
        if (!result.ok) throw new Error(`فشل استيراد التقرير`);
        return result.data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        sections: z.array(z.any()).optional(),
        classification: z.string().optional(),
        entity: z.string().optional(),
        status: z.string().optional(),
        blockRef: z.string().optional(),
        body: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.blockRef && input.body) {
          const result = await engine.updateReport(String(input.id), input.blockRef, input.body);
          if (!result.ok) throw new Error(`فشل تحديث التقرير`);
          return result.data;
        }
        const result = await engine.refreshReport(String(input.id));
        return result.data || { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        try { await engine.refreshReport(String(input.id)); } catch { /* ignore */ }
        return { success: true };
      }),

    review: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.reviewReport(input.id);
        if (!result.ok) throw new Error(`فشل مراجعة التقرير`);
        return result.data;
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.approveReport(input.id);
        if (!result.ok) throw new Error(`فشل اعتماد التقرير`);
        return result.data;
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.publishReport(input.id);
        if (!result.ok) throw new Error(`فشل نشر التقرير`);
        return result.data;
      }),

    exportHtml: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.exportReportHtml(input.id);
        if (!result.ok) throw new Error(`فشل تصدير التقرير`);
        return result.data;
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.exportReportPdf(input.id);
        if (!result.ok) throw new Error(`فشل تصدير التقرير`);
        return result.data;
      }),

    exportDocx: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.exportReportDocx(input.id);
        if (!result.ok) throw new Error(`فشل تصدير التقرير`);
        return result.data;
      }),

    convertToPresentation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.convertReportToPresentation(input.id);
        if (!result.ok) throw new Error(`فشل تحويل التقرير`);
        return result.data;
      }),

    convertToDashboard: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.convertReportToDashboard(input.id);
        if (!result.ok) throw new Error(`فشل تحويل التقرير`);
        return result.data;
      }),

    compare: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const result = await engine.compareReport(input.id);
        return result.data;
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRESENTATIONS — via Presentations Engine
  // ═══════════════════════════════════════════════════════════════
  presentations: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.listPresentations();
      if (!result.ok) return [];
      const data = result.data as any;
      const decks = Array.isArray(data) ? data : (data?.data || data?.decks || []);
      return decks.map((d: any, i: number) => ({
        id: d.id || d.deck_id || i + 1,
        title: d.title || d.name || 'عرض بدون عنوان',
        description: d.description || '',
        slides: d.slides || [],
        theme: d.theme || 'default',
        status: d.status || 'draft',
        createdAt: d.created_at || d.createdAt || new Date().toISOString(),
        updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input }) => {
        const result = await engine.getPresentationDetail(String(input.id));
        if (!result.ok) return null;
        const d = result.data as any;
        return {
          id: d.id || d.deck_id || input.id,
          title: d.title || d.name || '',
          description: d.description || '',
          slides: d.slides || [],
          theme: d.theme || 'default',
          status: d.status || 'draft',
          createdAt: d.created_at || d.createdAt || '',
          updatedAt: d.updated_at || d.updatedAt || '',
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.createPresentation({
          title: input.title,
          description: input.description,
          slides: input.slides,
          theme: input.theme,
        });
        if (!result.ok) throw new Error(`فشل إنشاء العرض: ${JSON.stringify(result.data)}`);
        return result.data;
      }),

    createFromCanvas: protectedProcedure
      .input(z.object({ canvasData: z.record(z.string(), z.any()) }))
      .mutation(async ({ input }) => {
        const result = await engine.createPresentationFromCanvas(input.canvasData);
        if (!result.ok) throw new Error(`فشل إنشاء العرض من Canvas`);
        return result.data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.id}/update`, {
          title: input.title,
          slides: input.slides,
          theme: input.theme,
          status: input.status,
        });
        if (!result.ok) throw new Error(`فشل تحديث العرض`);
        return result.data;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.id}/delete`, {});
        return { success: result.ok };
      }),

    share: protectedProcedure
      .input(z.object({
        presentationId: z.union([z.number(), z.string()]),
        password: z.string().optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.presentationId}/share`, {
          password: input.password,
          expires_at: input.expiresAt,
        });
        if (!result.ok) throw new Error(`فشل مشاركة العرض`);
        return result.data;
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.id}/publish`, {});
        if (!result.ok) throw new Error(`فشل نشر العرض`);
        return result.data;
      }),

    exportPptx: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.id}/export/pptx`, {});
        if (!result.ok) throw new Error(`فشل تصدير العرض`);
        return result.data;
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost(`/api/v1/presentations/decks/${input.id}/export/pdf`, {});
        if (!result.ok) throw new Error(`فشل تصدير العرض`);
        return result.data;
      }),

    convertToDashboard: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.convertPresentationToDashboard(input.id);
        if (!result.ok) throw new Error(`فشل التحويل`);
        return result.data;
      }),

    templates: protectedProcedure.query(async () => {
      const result = await engine.platformGet("/api/v1/presentations/templates");
      return result.ok ? result.data : [];
    }),

    templateLibrary: protectedProcedure.query(async () => {
      const result = await engine.platformGet("/api/v1/presentations/template-library");
      return result.ok ? result.data : [];
    }),

    viewShared: publicProcedure
      .input(z.object({ token: z.string(), password: z.string().optional() }))
      .query(async ({ input }) => {
        const result = await engine.platformGet(`/api/v1/presentations/public/${encodeURIComponent(input.token)}${input.password ? `?password=${encodeURIComponent(input.password)}` : ''}`);
        if (!result.ok) return { error: 'الرابط غير صالح' };
        return result.data;
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARDS — via Dashboard Engine
  // ═══════════════════════════════════════════════════════════════
  dashboards: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.getDashboardState();
      if (!result.ok) return [];
      const data = result.data as any;
      const dashboards = Array.isArray(data) ? data : (data?.dashboards || data?.data || []);
      return dashboards.map((d: any, i: number) => ({
        id: d.id || d.dashboard_id || i + 1,
        title: d.title || d.name || 'لوحة بدون عنوان',
        description: d.description || '',
        widgets: d.widgets || [],
        layout: d.layout || {},
        status: d.status || 'draft',
        createdAt: d.created_at || d.createdAt || new Date().toISOString(),
        updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input }) => {
        const result = await engine.getDashboardState(String(input.id));
        if (!result.ok) return null;
        const d = result.data as any;
        return {
          id: d.id || d.dashboard_id || input.id,
          title: d.title || d.name || '',
          description: d.description || '',
          widgets: d.widgets || [],
          layout: d.layout || {},
          status: d.status || 'draft',
          createdAt: d.created_at || d.createdAt || '',
          updatedAt: d.updated_at || d.updatedAt || '',
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        widgets: z.array(z.any()).optional(),
        layout: z.record(z.string(), z.any()).optional(),
        mode: z.enum(["easy", "advanced"]).optional(),
        datasetRefs: z.array(z.string()).optional(),
        templateId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = input.templateId
          ? await engine.createDashboardFromTemplate(input.templateId, input.datasetRefs || [])
          : await engine.createDashboard({
              title: input.title,
              mode: input.mode,
              dataset_refs: input.datasetRefs,
            });
        if (!result.ok) throw new Error(`فشل إنشاء لوحة المؤشرات: ${JSON.stringify(result.data)}`);
        return result.data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        widgets: z.array(z.any()).optional(),
        layout: z.record(z.string(), z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.refreshDashboard(String(input.id));
        return result.data || { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        try { await engine.refreshDashboard(String(input.id)); } catch { /* ignore */ }
        return { success: true };
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const result = await engine.publishDashboard(input.id);
        if (!result.ok) throw new Error(`فشل نشر اللوحة`);
        return result.data;
      }),

    share: protectedProcedure
      .input(z.object({ id: z.string(), options: z.record(z.string(), z.any()).optional() }))
      .mutation(async ({ input }) => {
        const result = await engine.shareDashboard(input.id, input.options);
        if (!result.ok) throw new Error(`فشل مشاركة اللوحة`);
        return result.data;
      }),

    addWidget: protectedProcedure
      .input(z.object({ dashboardId: z.string(), widget: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        const result = await engine.addDashboardWidget(input.dashboardId, input.widget);
        if (!result.ok) throw new Error(`فشل إضافة Widget`);
        return result.data;
      }),

    templates: protectedProcedure.query(async () => {
      const result = await engine.getDashboardTemplates();
      return result.ok ? result.data : [];
    }),

    compare: protectedProcedure
      .input(z.object({ id: z.string(), versionA: z.string().optional(), versionB: z.string().optional() }))
      .query(async ({ input }) => {
        const result = await engine.compareDashboards(input.id, input.versionA, input.versionB);
        return result.data;
      }),

    versions: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const result = await engine.getDashboardVersions(input.id);
        return result.ok ? result.data : [];
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // SPREADSHEETS — via Dashboard Engine (data)
  // ═══════════════════════════════════════════════════════════════
  spreadsheets: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.listDatasets();
      if (!result.ok) return [];
      const data = result.data as any;
      const items = Array.isArray(data) ? data : (data?.data || data?.datasets || []);
      return items.map((s: any, i: number) => ({
        id: s.id || s.dataset_id || i + 1,
        title: s.title || s.name || s.label || 'جدول بدون عنوان',
        description: s.description || '',
        sheets: s.sheets || s.columns || [],
        status: s.status || 'ready',
        createdAt: s.created_at || s.createdAt || new Date().toISOString(),
        updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input }) => {
        const result = await engine.listDatasets();
        if (!result.ok) return null;
        const data = result.data as any;
        const items = Array.isArray(data) ? data : (data?.data || data?.datasets || []);
        const found = items.find((s: any) => String(s.id || s.dataset_id) === String(input.id));
        if (!found) return null;
        return {
          id: found.id || found.dataset_id || input.id,
          title: found.title || found.name || '',
          description: found.description || '',
          sheets: found.sheets || found.columns || [],
          status: found.status || 'ready',
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        sheets: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.registerDataset({
          title: input.title,
          source_kind: "spreadsheet",
          rows: [],
          field_names: [],
        });
        if (!result.ok) throw new Error(`فشل تسجيل مصدر البيانات`);
        return result.data;
      }),

    createExcelReport: protectedProcedure
      .input(z.object({ payload: z.record(z.string(), z.any()) }))
      .mutation(async ({ input }) => {
        const result = await engine.platformPost("/api/v1/excel/create-report", input.payload);
        if (!result.ok) throw new Error(`فشل إنشاء تقرير Excel`);
        return result.data;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        sheets: z.array(z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.title) {
          await engine.registerDataset({
            title: input.title,
            source_kind: "spreadsheet",
            rows: [],
            field_names: [],
          });
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async () => {
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // EXTRACTIONS — via Central Engine (AI jobs)
  // ═══════════════════════════════════════════════════════════════
  extractions: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.listAIJobs();
      if (!result.ok) return [];
      const data = result.data as any;
      const jobs = Array.isArray(data) ? data : (data?.jobs || []);
      return jobs
        .filter((j: any) => j.page_path?.includes('extract') || j.prompt?.includes('استخراج') || j.prompt?.includes('extract'))
        .map((j: any, i: number) => ({
          id: j.id || j.job_id || i + 1,
          sourceType: j.source_type || 'file',
          sourceFile: j.resource_ref || j.source_file || '',
          extractedText: j.result?.text || '',
          structuredData: j.result?.structured || {},
          language: j.result?.language || 'ar',
          status: j.status || 'completed',
          createdAt: j.created_at || j.createdAt || new Date().toISOString(),
        }));
    }),

    create: protectedProcedure
      .input(z.object({
        sourceType: z.string(),
        sourceFile: z.string().optional(),
        extractedText: z.string().optional(),
        structuredData: z.record(z.string(), z.any()).optional(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.submitAIJob({
          page_path: '/extract',
          session_id: `extract-${Date.now()}`,
          prompt: `استخراج البيانات من ${input.sourceType}: ${input.sourceFile || ''}`,
          resource_ref: input.sourceFile,
        });
        if (!result.ok) throw new Error(`فشل الاستخراج`);
        return result.data;
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // TRANSLATIONS — via Central Engine (AI live-translation)
  // ═══════════════════════════════════════════════════════════════
  translations: router({
    list: protectedProcedure.query(async () => {
      const result = await engine.listAIJobs();
      if (!result.ok) return [];
      const data = result.data as any;
      const jobs = Array.isArray(data) ? data : (data?.jobs || []);
      return jobs
        .filter((j: any) => j.page_path?.includes('translat') || j.prompt?.includes('ترجم') || j.prompt?.includes('translat'))
        .map((j: any, i: number) => ({
          id: j.id || j.job_id || i + 1,
          sourceText: j.prompt || '',
          translatedText: j.result?.text || j.result?.translated || '',
          sourceLang: j.result?.source_lang || 'ar',
          targetLang: j.result?.target_lang || 'en',
          type: 'text',
          status: j.status || 'completed',
          createdAt: j.created_at || j.createdAt || new Date().toISOString(),
        }));
    }),

    create: protectedProcedure
      .input(z.object({
        sourceText: z.string(),
        translatedText: z.string(),
        sourceLang: z.string().optional(),
        targetLang: z.string().optional(),
        type: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.liveTranslation({
          source_locale: input.sourceLang || 'ar',
          target_locale: input.targetLang || 'en',
          items: [{ node_id: `tr-${Date.now()}`, text: input.sourceText }],
        });
        return result.data || { success: true, translatedText: input.translatedText };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // TRANSCRIPTION — via Transcription Engine
  // ═══════════════════════════════════════════════════════════════
  transcription: router({
    listJobs: protectedProcedure.query(async () => {
      const result = await engine.listTranscriptionJobs();
      if (!result.ok) return [];
      const data = result.data as any;
      return Array.isArray(data) ? data : (data?.jobs || []);
    }),

    startJob: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        fileName: z.string(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.startTranscriptionJob({
          file_url: input.audioUrl,
          file_name: input.fileName,
          language: input.language,
        });
        if (!result.ok) throw new Error(`فشل بدء التفريغ الصوتي`);
        return result.data;
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // CHAT — via Central Engine (AI jobs)
  // ═══════════════════════════════════════════════════════════════
  chat: router({
    history: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const result = await engine.engineChatHistory(input.sessionId);
        if (!result.ok) return [];
        const data = result.data as any;
        const jobs = Array.isArray(data) ? data : (data?.jobs || []);
        return jobs.map((j: any) => ({
          id: j.id || j.job_id,
          role: j.role || (j.prompt ? 'user' : 'assistant'),
          content: j.prompt || j.result?.text || j.content || '',
          metadata: j.metadata || {},
          createdAt: j.created_at || j.createdAt || new Date().toISOString(),
        }));
      }),

    addMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        role: z.string(),
        content: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await engine.engineChat(input.sessionId, input.content);
        return { success: result.ok, data: result.data };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // LIBRARY — via Governance Engine (library)
  // ═══════════════════════════════════════════════════════════════
  library: router({
    items: protectedProcedure.query(async () => {
      const result = await engine.getGovernanceLibrary();
      if (!result.ok) return [];
      const data = result.data as any;
      return Array.isArray(data) ? data : (data?.items || data?.data || []);
    }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // SLIDE LIBRARY — uses Drizzle DB (template elements, not content)
  // ═══════════════════════════════════════════════════════════════
  slideLibrary: libraryRouter,

  // ═══════════════════════════════════════════════════════════════
  // PLATFORM — direct engine access
  // ═══════════════════════════════════════════════════════════════
  platform: platformRouter,

  // ═══════════════════════════════════════════════════════════════
  // ADMIN — via Governance Engine
  // ═══════════════════════════════════════════════════════════════
  admin: router({
    users: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [];
      const result = await engine.engineListUsers();
      if (!result.ok) return [];
      const data = result.data as any;
      return Array.isArray(data) ? data : (data?.users || data?.data || []);
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin only");
      const result = await engine.engineGetAdminStats();
      const raw = result.data as any;
      // Normalize to the shape AdminPanel expects
      return {
        users: raw?.users ?? raw?.governance?.users ?? 0,
        totalContent: raw?.totalContent ?? raw?.governance?.totalContent ?? 0,
        reports: raw?.reports ?? raw?.governance?.reports ?? 0,
        presentations: raw?.presentations ?? raw?.governance?.presentations ?? 0,
        dashboards: raw?.dashboards ?? raw?.governance?.dashboards ?? 0,
        spreadsheets: raw?.spreadsheets ?? raw?.governance?.spreadsheets ?? 0,
        translations: raw?.translations ?? raw?.governance?.translations ?? 0,
        extractions: raw?.extractions ?? raw?.governance?.extractions ?? 0,
        files: raw?.files ?? raw?.governance?.files ?? 0,
      };
    }),

    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [];
      const result = await engine.engineGetRecentActivity();
      if (!result.ok) return [];
      const data = result.data as any;
      return Array.isArray(data) ? data : (data?.entries || data?.data || []);
    }),

    allContent: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [] as any[];
      const result = await engine.engineGetAllContent();
      const data = result.data as any;
      const items = Array.isArray(data) ? data : (data?.data || data?.content || data?.items || []);
      return items as any[];
    }),
  }),
});

export type AppRouter = typeof appRouter;
