import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { aiRouter } from "./aiRouter";
import { libraryRouter } from "./libraryRouter";
import { loginUser, registerUser, setAuthCookie, clearAuthCookie } from "./localAuth";
import { seedAdminAccount } from "./seed";
import {
  getFilesByUserId, createFile, deleteFile, toggleFavorite, updateFile, getFileById,
  getReportsByUserId, createReport, updateReport, deleteReport, getReportById,
  getPresentationsByUserId, createPresentation, updatePresentation, deletePresentation, getPresentationById,
  getDashboardsByUserId, createDashboard, updateDashboard, deleteDashboard, getDashboardById,
  getSpreadsheetsByUserId, createSpreadsheet, updateSpreadsheet, deleteSpreadsheet, getSpreadsheetById,
  getChatHistory, addChatMessage,
  getLibraryItems, getAllUsers,
  getExtractionsByUserId, createExtraction,
  getTranslationsByUserId, createTranslation,
  createSharedPresentation, getSharedPresentation, getMySharedPresentations, deleteSharedPresentation, updateSharedPresentation,
  getAdminStats, getRecentActivity, getAllContent,
} from "./localDb";
import { z } from "zod";

// Seed admin on server start
seedAdminAccount().catch(console.error);

export const appRouter = router({
  // ─── Auth ─────────────────────────────────────────────────────
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

  // ─── AI ───────────────────────────────────────────────────────
  ai: aiRouter,

  // ─── Files ────────────────────────────────────────────────────
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getFilesByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getFileById(input.id, ctx.user.id);
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
        return createFile({ ...input, userId: ctx.user.id });
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
        const { id, ...data } = input;
        await updateFile(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteFile(input.id, ctx.user.id);
        return { success: true };
      }),

    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await toggleFavorite(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Reports ──────────────────────────────────────────────────
  reports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getReportsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getReportById(input.id, ctx.user.id);
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
        return createReport({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        sections: z.array(z.any()).optional(),
        classification: z.string().optional(),
        entity: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateReport(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteReport(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Presentations ────────────────────────────────────────────
  presentations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPresentationsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getPresentationById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createPresentation({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        slides: z.array(z.any()).optional(),
        theme: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updatePresentation(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deletePresentation(input.id, ctx.user.id);
        return { success: true };
      }),

    // ── Sharing ──
    share: protectedProcedure
      .input(z.object({
        presentationId: z.number(),
        password: z.string().optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pres = await getPresentationById(input.presentationId, ctx.user.id);
        if (!pres) throw new Error('العرض غير موجود');
        const shared = await createSharedPresentation({
          presentationId: input.presentationId,
          userId: ctx.user.id,
          title: pres.title as string,
          slides: pres.slides as string || '[]',
          theme: pres.theme as string || 'default',
          brandKit: '{}',
          password: input.password,
          expiresAt: input.expiresAt,
        });
        return shared;
      }),

    myShares: protectedProcedure.query(async ({ ctx }) => {
      return getMySharedPresentations(ctx.user.id);
    }),

    deleteShare: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteSharedPresentation(input.id, ctx.user.id);
        return { success: true };
      }),

    updateShare: protectedProcedure
      .input(z.object({
        id: z.number(),
        isPublic: z.number().optional(),
        password: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateSharedPresentation(id, ctx.user.id, data);
        return { success: true };
      }),

    // Public route to view shared presentation
    viewShared: publicProcedure
      .input(z.object({
        token: z.string(),
        password: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const shared = await getSharedPresentation(input.token);
        if (!shared) return { error: 'الرابط غير صالح أو منتهي الصلاحية' };
        // Check expiry
        if (shared.expiresAt && new Date(shared.expiresAt as string) < new Date()) {
          return { error: 'انتهت صلاحية هذا الرابط' };
        }
        // Check password
        if (shared.password && shared.password !== input.password) {
          return { needsPassword: true, title: shared.title };
        }
        return {
          title: shared.title,
          slides: shared.slides,
          theme: shared.theme,
          brandKit: shared.brandKit,
          viewCount: shared.viewCount,
        };
      }),
  }),

  // ─── Dashboards ───────────────────────────────────────────────
  dashboards: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getDashboardById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        widgets: z.array(z.any()).optional(),
        layout: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createDashboard({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        widgets: z.array(z.any()).optional(),
        layout: z.record(z.string(), z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateDashboard(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteDashboard(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Spreadsheets ─────────────────────────────────────────────
  spreadsheets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getSpreadsheetsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getSpreadsheetById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        sheets: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createSpreadsheet({ ...input, userId: ctx.user.id });
        return result || { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        sheets: z.array(z.any()).optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateSpreadsheet(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteSpreadsheet(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Extractions ──────────────────────────────────────────────
  extractions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getExtractionsByUserId(ctx.user.id);
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
        return createExtraction({ ...input, userId: ctx.user.id });
      }),
  }),

  // ─── Translations ─────────────────────────────────────────────
  translations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTranslationsByUserId(ctx.user.id);
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
        return createTranslation({ ...input, userId: ctx.user.id });
      }),
  }),

  // ─── Chat History ─────────────────────────────────────────────
  chat: router({
    history: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        return getChatHistory(ctx.user.id, input.sessionId);
      }),

    addMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        role: z.string(),
        content: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await addChatMessage({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
  }),

  // ─── Library (aggregated) ─────────────────────────────────────
  library: router({
    items: protectedProcedure.query(async ({ ctx }) => {
      return getLibraryItems(ctx.user.id);
    }),
  }),

  // ─── Slide Element Library (Admin-managed) ───────────────────
  slideLibrary: libraryRouter,

  // ─── Admin ────────────────────────────────────────────────────
  admin: router({
    users: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        return [];
      }
      return getAllUsers();
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Admin only");
      }
      return getAdminStats();
    }),
    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        return [];
      }
      return getRecentActivity();
    }),
    allContent: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        return [];
      }
      return getAllContent();
    }),
  }),
});

export type AppRouter = typeof appRouter;
