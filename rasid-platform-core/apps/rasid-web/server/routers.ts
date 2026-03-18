/**
 * routers.ts — LOCAL SQLite database for all CRUD operations
 *
 * ██████████████████████████████████████████████████████████████
 * ██  LOCAL SQLite via sql.js  ·  No external engine needed   ██
 * ██  AI/SlideLibrary/Platform routers kept as-is             ██
 * ██████████████████████████████████████████████████████████████
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { aiRouter } from "./aiRouter";
import { libraryRouter } from "./libraryRouter";
import { platformRouter } from "./platformRouter";
import { strictEngineRouter } from "./strictEngineRouter";
import { presentationAddendumRouter } from "./presentationAddendumRouter";
import { loginUser, registerUser, setAuthCookie, clearAuthCookie } from "./localAuth";
import * as localDb from "./localDb";
import * as engine from "./platformConnector";
import { z } from "zod";

export const appRouter = router({
  // ═══════════════════════════════════════════════════════════════
  // AUTH — via Local SQLite DB
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
  // AI — via OpenAI + Engine AI Jobs (KEPT AS-IS)
  // ═══════════════════════════════════════════════════════════════
  ai: aiRouter,

  // ═══════════════════════════════════════════════════════════════
  // FILES — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getFilesByUserId(userId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getFileById(input.id, userId);
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
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createFile({ userId, ...input });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        status: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { id, ...data } = input;
        await localDb.updateFile(id, userId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteFile(input.id, userId);
        return { success: true };
      }),

    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.toggleFavorite(input.id, userId);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // REPORTS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  reports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getReportsByUserId(userId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getReportById(Number(input.id), userId);
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
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createReport({ userId, ...input });
      }),

    createFromExcel: protectedProcedure
      .input(z.object({
        fileUrl: z.string(),
        title: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createReport({ userId, title: input.title || 'تقرير من Excel', reportType: 'excel' });
      }),

    createFromTranscription: protectedProcedure
      .input(z.object({
        transcriptionJobId: z.string(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createReport({ userId, title: 'تقرير من التفريغ الصوتي', reportType: 'transcription' });
      }),

    import: protectedProcedure
      .input(z.object({ payload: z.record(z.string(), z.any()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const p = input.payload as any;
        return localDb.createReport({ userId, title: p.title || 'تقرير مستورد', description: p.description, sections: p.sections, reportType: p.reportType || 'imported' });
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
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { id, blockRef, body, ...data } = input;
        if (blockRef && body) {
          // Update specific section content
          const report = await localDb.getReportById(Number(id), userId);
          if (report) {
            let sections = [];
            try { sections = JSON.parse(report.sections as string || '[]'); } catch { sections = []; }
            const idx = sections.findIndex((s: any) => s.ref === blockRef || s.id === blockRef);
            if (idx >= 0) { sections[idx].body = body; }
            await localDb.updateReport(Number(id), userId, { ...data, sections });
          }
          return { success: true };
        }
        await localDb.updateReport(Number(id), userId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteReport(Number(input.id), userId);
        return { success: true };
      }),

    review: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.updateReport(Number(input.id), userId, { status: 'reviewed' });
        return { success: true };
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.updateReport(Number(input.id), userId, { status: 'approved' });
        return { success: true };
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.updateReport(Number(input.id), userId, { status: 'published' });
        return { success: true };
      }),

    exportHtml: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        return { html: `<h1>${report.title}</h1><div>${report.description || ''}</div>`, title: report.title };
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        return { success: true, message: 'PDF export not available in local mode', title: report.title };
      }),

    exportDocx: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        return { success: true, message: 'DOCX export not available in local mode', title: report.title };
      }),

    convertToPresentation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        const pres = await localDb.createPresentation({ userId, title: `عرض من: ${report.title}`, description: report.description as string || '' });
        return pres;
      }),

    convertToDashboard: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        const dash = await localDb.createDashboard({ userId, title: `لوحة من: ${report.title}`, description: report.description as string || '' });
        return dash;
      }),

    compare: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        return { current: report, previous: null };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRESENTATIONS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  presentations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getPresentationsByUserId(userId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getPresentationById(Number(input.id), userId);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createPresentation({ userId, ...input });
      }),

    createFromCanvas: protectedProcedure
      .input(z.object({ canvasData: z.record(z.string(), z.any()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const cd = input.canvasData as any;
        return localDb.createPresentation({ userId, title: cd.title || 'عرض من Canvas', slides: cd.slides || [], theme: cd.theme || 'default' });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { id, ...data } = input;
        await localDb.updatePresentation(Number(id), userId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deletePresentation(Number(input.id), userId);
        return { success: true };
      }),

    share: protectedProcedure
      .input(z.object({
        presentationId: z.union([z.number(), z.string()]),
        password: z.string().optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const pres = await localDb.getPresentationById(Number(input.presentationId), userId);
        if (!pres) throw new Error('العرض غير موجود');
        const shared = await localDb.createSharedPresentation({
          presentationId: Number(input.presentationId),
          userId,
          title: pres.title as string,
          slides: pres.slides as string || '[]',
          theme: pres.theme as string || 'default',
          brandKit: '{}',
          password: input.password,
        });
        return shared;
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.updatePresentation(Number(input.id), userId, { status: 'published' });
        return { success: true };
      }),

    exportPptx: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const pres = await localDb.getPresentationById(Number(input.id), userId);
        if (!pres) throw new Error('العرض غير موجود');
        return { success: true, message: 'PPTX export not available in local mode', title: pres.title };
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const pres = await localDb.getPresentationById(Number(input.id), userId);
        if (!pres) throw new Error('العرض غير موجود');
        return { success: true, message: 'PDF export not available in local mode', title: pres.title };
      }),

    convertToDashboard: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const pres = await localDb.getPresentationById(Number(input.id), userId);
        if (!pres) throw new Error('العرض غير موجود');
        const dash = await localDb.createDashboard({ userId, title: `لوحة من: ${pres.title}`, description: pres.description as string || '' });
        return dash;
      }),

    templates: protectedProcedure.query(async () => {
      return [];
    }),

    templateLibrary: protectedProcedure.query(async () => {
      return [];
    }),

    viewShared: publicProcedure
      .input(z.object({ token: z.string(), password: z.string().optional() }))
      .query(async ({ input }) => {
        const shared = await localDb.getSharedPresentation(input.token);
        if (!shared) return { error: 'الرابط غير صالح' };
        if (shared.password && shared.password !== input.password) return { error: 'كلمة المرور غير صحيحة' };
        return shared;
      }),

    // ═══ Enhanced Presentation Operations (from package) ═══
    createEnhanced: protectedProcedure
      .input(z.object({
        title: z.string(),
        topic: z.string().optional(),
        themeId: z.number().optional(),
        slideCount: z.number().optional(),
        style: z.string().optional(),
        contentSource: z.string().optional(),
        usedBananaPro: z.boolean().optional(),
        toc: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const id = await localDb.createPresentationEnhanced({ userId, ...input });
        return { id, title: input.title };
      }),

    updateEnhanced: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        topic: z.string().optional(),
        themeId: z.number().optional(),
        slideCount: z.number().optional(),
        status: z.string().optional(),
        style: z.string().optional(),
        contentSource: z.string().optional(),
        usedBananaPro: z.boolean().optional(),
        toc: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await localDb.updatePresentationEnhanced(id, data);
        return { success: true };
      }),

    getByIdDirect: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return localDb.getPresentationByIdNoUser(input.id);
      }),

    // ═══ Slide Operations (separate table) ═══
    getSlides: publicProcedure
      .input(z.object({ presentationId: z.number() }))
      .query(async ({ input }) => {
        return localDb.getSlidesByPresentation(input.presentationId);
      }),

    getSlide: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return localDb.getSlideById(input.id);
      }),

    saveSlide: protectedProcedure
      .input(z.object({
        presentationId: z.number(),
        slideIndex: z.number(),
        title: z.string(),
        layout: z.string().optional(),
        data: z.string(),
        htmlCode: z.string().optional(),
        isEdited: z.boolean().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await localDb.createSlide(input);
        return { id };
      }),

    updateSlide: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        layout: z.string().optional(),
        data: z.string().optional(),
        htmlCode: z.string().optional(),
        isEdited: z.boolean().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await localDb.updateSlideRecord(id, data);
        return { success: true };
      }),

    deleteSlide: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await localDb.deleteSlideRecord(input.id);
        return { success: true };
      }),

    deleteAllSlides: protectedProcedure
      .input(z.object({ presentationId: z.number() }))
      .mutation(async ({ input }) => {
        await localDb.deleteSlidesByPresentation(input.presentationId);
        return { success: true };
      }),

    deleteWithSlides: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteSlidesByPresentation(input.id);
        await localDb.deletePresentation(input.id, userId);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARDS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  dashboards: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getDashboardsByUserId(userId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getDashboardById(Number(input.id), userId);
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
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createDashboard({ userId, title: input.title, description: input.description, widgets: input.widgets, layout: input.layout });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        widgets: z.array(z.any()).optional(),
        layout: z.record(z.string(), z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { id, ...data } = input;
        await localDb.updateDashboard(Number(id), userId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteDashboard(Number(input.id), userId);
        return { success: true };
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.updateDashboard(Number(input.id), userId, { status: 'published' });
        return { success: true };
      }),

    share: protectedProcedure
      .input(z.object({ id: z.string(), options: z.record(z.string(), z.any()).optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const dash = await localDb.getDashboardById(Number(input.id), userId);
        if (!dash) throw new Error('اللوحة غير موجودة');
        return { success: true, shareUrl: `/dashboard/shared/${input.id}` };
      }),

    addWidget: protectedProcedure
      .input(z.object({ dashboardId: z.string(), widget: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const dash = await localDb.getDashboardById(Number(input.dashboardId), userId);
        if (!dash) throw new Error('اللوحة غير موجودة');
        let widgets = [];
        try { widgets = JSON.parse(dash.widgets as string || '[]'); } catch { widgets = []; }
        widgets.push(input.widget);
        await localDb.updateDashboard(Number(input.dashboardId), userId, { widgets });
        return { success: true };
      }),

    templates: protectedProcedure.query(async () => {
      return [];
    }),

    compare: protectedProcedure
      .input(z.object({ id: z.string(), versionA: z.string().optional(), versionB: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const dash = await localDb.getDashboardById(Number(input.id), userId);
        return { current: dash, previous: null };
      }),

    versions: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async () => {
        return [];
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // SPREADSHEETS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  spreadsheets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getSpreadsheetsByUserId(userId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getSpreadsheetById(Number(input.id), userId);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        sheets: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createSpreadsheet({ userId, ...input });
      }),

    createExcelReport: protectedProcedure
      .input(z.object({ payload: z.record(z.string(), z.any()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const p = input.payload as any;
        return localDb.createSpreadsheet({ userId, title: p.title || 'تقرير Excel', sheets: p.sheets || [] });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.union([z.number(), z.string()]),
        title: z.string().optional(),
        sheets: z.array(z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { id, ...data } = input;
        await localDb.updateSpreadsheet(Number(id), userId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteSpreadsheet(Number(input.id), userId);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // EXTRACTIONS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  extractions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getExtractionsByUserId(userId);
    }),

    create: protectedProcedure
      .input(z.object({
        sourceType: z.string(),
        sourceFile: z.string().optional(),
        extractedText: z.string().optional(),
        structuredData: z.record(z.string(), z.any()).optional(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createExtraction({ userId, ...input });
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // TRANSLATIONS — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  translations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getTranslationsByUserId(userId);
    }),

    create: protectedProcedure
      .input(z.object({
        sourceText: z.string(),
        translatedText: z.string(),
        sourceLang: z.string().optional(),
        targetLang: z.string().optional(),
        type: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.createTranslation({ userId, ...input });
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // TRANSCRIPTION — via Engine (kept as-is, needs actual audio processing)
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
  // CHAT — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  chat: router({
    history: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        return localDb.getChatHistory(userId, input.sessionId);
      }),

    addMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        role: z.string(),
        content: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.addChatMessage({ userId, ...input });
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // LIBRARY — via Local SQLite DB (aggregated view)
  // ═══════════════════════════════════════════════════════════════
  library: router({
    items: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getLibraryItems(userId);
    }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // SLIDE LIBRARY — uses Drizzle DB (KEPT AS-IS)
  // ═══════════════════════════════════════════════════════════════
  slideLibrary: libraryRouter,

  // ═══════════════════════════════════════════════════════════════
  // PLATFORM — direct engine access (KEPT AS-IS)
  // ═══════════════════════════════════════════════════════════════
  platform: platformRouter,

  // ═══════════════════════════════════════════════════════════════
  // STRICT ENGINE — Visual Matching Engine 1:1
  // ═══════════════════════════════════════════════════════════════
  strictEngine: strictEngineRouter,

  // ═══════════════════════════════════════════════════════════════
  // PRESENTATION ADDENDUM — Catalog, Controls, Transforms, Data, Dashboard
  // ═══════════════════════════════════════════════════════════════
  presentationAddendum: presentationAddendumRouter,

  // ═══════════════════════════════════════════════════════════════
  // ADMIN — via Local SQLite DB
  // ═══════════════════════════════════════════════════════════════
  admin: router({
    users: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [];
      return localDb.getAllUsers();
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin only");
      return localDb.getAdminStats();
    }),

    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [];
      // Aggregate recent items from all tables as activity
      const userId = (ctx as any).user?.id || 1;
      const items = await localDb.getLibraryItems(userId);
      return items.slice(0, 20).map((item: any) => ({
        id: item.id,
        type: item.source || item.type,
        title: item.title,
        action: 'created',
        timestamp: item.createdAt || item.updatedAt,
      }));
    }),

    allContent: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") return [] as any[];
      const userId = (ctx as any).user?.id || 1;
      return localDb.getLibraryItems(userId);
    }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // THEMES — System + User-created themes
  // ═══════════════════════════════════════════════════════════════
  themes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getAllThemesForUser(userId);
    }),

    systemThemes: publicProcedure.query(async () => {
      return localDb.getSystemThemes();
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return localDb.getThemeById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.string().optional(),
        isTemplate: z.boolean().optional(),
        colors: z.string(),
        typography: z.string(),
        logoUrl: z.string().optional(),
        backgroundUrl: z.string().optional(),
        customCss: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const id = await localDb.createTheme({ userId, ...input });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        colors: z.string().optional(),
        typography: z.string().optional(),
        logoUrl: z.string().optional(),
        backgroundUrl: z.string().optional(),
        customCss: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await localDb.updateTheme(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await localDb.deleteTheme(input.id);
        return { success: true };
      }),

    // Template Elements
    elements: router({
      list: publicProcedure
        .input(z.object({ themeId: z.number(), category: z.string().optional() }))
        .query(async ({ input }) => {
          return localDb.getElementsByTheme(input.themeId, input.category);
        }),

      get: publicProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          return localDb.getElementById(input.id);
        }),

      create: protectedProcedure
        .input(z.object({
          themeId: z.number(),
          name: z.string(),
          category: z.string(),
          subCategory: z.string().optional(),
          htmlCode: z.string(),
          thumbnailUrl: z.string().optional(),
          config: z.string().optional(),
          tags: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const userId = (ctx as any).user?.id || 1;
          const id = await localDb.createElement({ userId, ...input });
          return { id };
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          category: z.string().optional(),
          htmlCode: z.string().optional(),
          config: z.string().optional(),
          tags: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await localDb.updateElement(id, data);
          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await localDb.deleteElement(input.id);
          return { success: true };
        }),

      search: publicProcedure
        .input(z.object({ themeId: z.number(), query: z.string() }))
        .query(async ({ input }) => {
          return localDb.searchElements(input.themeId, input.query);
        }),

      count: publicProcedure
        .input(z.object({ themeId: z.number() }))
        .query(async ({ input }) => {
          return localDb.getElementCountByTheme(input.themeId);
        }),
    }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // USER FILES — Upload and manage user files
  // ═══════════════════════════════════════════════════════════════
  userFiles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      return localDb.getUserFilesNew(userId);
    }),

    upload: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        base64Data: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = (ctx as any).user?.id || 1;
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileSize = buffer.length;
        if (fileSize > 16 * 1024 * 1024) throw new Error('File too large (max 16MB)');

        // Save to local uploads directory
        const fs = await import('fs');
        const path = await import('path');
        const uploadsDir = path.join(process.cwd(), 'uploads', `user-${userId}`);
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = input.fileName.split('.').pop() || 'bin';
        const fileKey = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = path.join(uploadsDir, fileKey);
        fs.writeFileSync(filePath, buffer);

        const url = `/uploads/user-${userId}/${fileKey}`;
        const id = await localDb.createUserFile({ userId, fileName: input.fileName, mimeType: input.mimeType, fileSize, fileKey, url });
        return { id, url, fileName: input.fileName };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await localDb.deleteUserFile(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
