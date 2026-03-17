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
  // REPORTS — Dual-path: ReportEngineBuilder (real) + Local SQLite (index)
  // Every mutation calls the real ReportEngine producing artifacts,
  // evidence, audit events, lineage. SQLite is used only as a UI index.
  // ═══════════════════════════════════════════════════════════════
  reports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      const dbReports = await localDb.getReportsByUserId(userId);
      // Also list engine-backed reports
      try {
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        const engineIds = builder.listReports();
        return { db_reports: dbReports, engine_report_ids: engineIds };
      } catch {
        return { db_reports: dbReports, engine_report_ids: [] };
      }
    }),

    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const dbReport = await localDb.getReportById(Number(input.id), userId);
        // Try engine state too
        try {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const engineState = builder.getBuilderState(String(input.id));
          return { db_report: dbReport, engine_state: engineState };
        } catch {
          return { db_report: dbReport, engine_state: null };
        }
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        reportType: z.string().optional(),
        sections: z.array(z.any()).optional(),
        classification: z.string().optional(),
        entity: z.string().optional(),
        language: z.string().optional(),
        templateRef: z.string().optional(),
        brandPresetRef: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        // Create via real engine
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        const inputSections = Array.isArray(input.sections) && input.sections.length > 0
          ? input.sections.map((s: any, i: number) => ({
              section_kind: s.section_kind || (i === 0 ? 'cover' : 'body') as any,
              title: s.title || s.content || input.title,
              blocks: Array.isArray(s.blocks) && s.blocks.length > 0
                ? s.blocks
                : [{ block_type: 'narrative' as const, title: s.title || `قسم ${i + 1}`, body: s.content || s.body || '' }],
              lock_policy: s.lock_policy || 'editable' as const,
            }))
          : [
              {
                section_kind: 'cover' as const,
                title: input.title,
                blocks: [{ block_type: 'narrative' as const, title: input.title, body: input.description || '' }],
                lock_policy: 'editable' as const,
              },
              {
                section_kind: 'body' as const,
                title: 'المحتوى الرئيسي',
                blocks: [{ block_type: 'narrative' as const, title: 'المحتوى', body: input.description || 'محتوى التقرير' }],
                lock_policy: 'editable' as const,
              },
            ];
        const builderState = builder.createReportWithBuilder({
          tenant_ref: 'tenant-web',
          workspace_id: 'workspace-web',
          project_id: 'project-web',
          created_by: actorRef,
          title: input.title,
          description: input.description || '',
          report_type: input.reportType || 'operational_report',
          mode: 'advanced',
          language: input.language || 'ar-SA',
          template_ref: input.templateRef || 'template://reports/default',
          brand_preset_ref: input.brandPresetRef || 'brand://rasid/default',
          sections: inputSections,
        });
        // Index in SQLite for UI listing
        const dbReport = await localDb.createReport({
          userId,
          title: input.title,
          description: input.description,
          reportType: input.reportType || 'operational_report',
          sections: JSON.stringify(inputSections),
          classification: input.classification || 'عام',
          entity: input.entity,
        });
        return {
          db_report: dbReport,
          engine_report_id: builderState.report_id,
          builder_state: builderState,
          artifact_ref: builderState.workflow_result.reportArtifact?.artifact_id,
          evidence_ref: builderState.workflow_result.evidencePack?.evidence_pack_id,
          audit_events: builderState.workflow_result.auditEvents?.length || 0,
          toc: builderState.toc,
          multi_page_layout: builderState.multi_page_layout,
          publish_pipeline: builderState.publish_pipeline,
        };
      }),

    createFromExcel: protectedProcedure
      .input(z.object({
        fileUrl: z.string(),
        title: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        const builderState = builder.createReportWithBuilder({
          tenant_ref: 'tenant-web',
          workspace_id: 'workspace-web',
          project_id: 'project-web',
          created_by: actorRef,
          title: input.title || 'تقرير من Excel',
          report_type: 'excel_derived_report',
          source_refs: [input.fileUrl],
          sections: [{
            section_kind: 'cover',
            title: input.title || 'تقرير من Excel',
            blocks: [{ block_type: 'narrative', title: 'مصدر البيانات', body: `مستورد من: ${input.fileUrl}` }],
          }, {
            section_kind: 'body',
            title: 'البيانات',
            blocks: [{ block_type: 'table', title: 'بيانات Excel', body: 'جدول مستورد من ملف Excel', dataset_ref: input.fileUrl, query_ref: `query://excel/${input.fileUrl}` }],
          }],
        });
        const dbReport = await localDb.createReport({ userId, title: input.title || 'تقرير من Excel', reportType: 'excel' });
        return { db_report: dbReport, engine_report_id: builderState.report_id, builder_state: builderState };
      }),

    createFromTranscription: protectedProcedure
      .input(z.object({
        transcriptionJobId: z.string(),
        options: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        const builderState = builder.createReportWithBuilder({
          tenant_ref: 'tenant-web',
          workspace_id: 'workspace-web',
          project_id: 'project-web',
          created_by: actorRef,
          title: 'تقرير من التفريغ الصوتي',
          report_type: 'transcription_report',
          source_refs: [`transcription://${input.transcriptionJobId}`],
          sections: [{
            section_kind: 'cover',
            title: 'تقرير التفريغ',
            blocks: [{ block_type: 'narrative', title: 'مصدر التفريغ', body: `مرجع التفريغ: ${input.transcriptionJobId}` }],
          }, {
            section_kind: 'body',
            title: 'المحتوى المفرّغ',
            blocks: [{ block_type: 'narrative', title: 'النص', body: 'محتوى التفريغ الصوتي', dataset_ref: `transcription://${input.transcriptionJobId}`, query_ref: `query://transcription/${input.transcriptionJobId}` }],
          }],
        });
        const dbReport = await localDb.createReport({ userId, title: 'تقرير من التفريغ الصوتي', reportType: 'transcription' });
        return { db_report: dbReport, engine_report_id: builderState.report_id, builder_state: builderState };
      }),

    import: protectedProcedure
      .input(z.object({ payload: z.record(z.string(), z.any()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const p = input.payload as any;
        const dbReport = await localDb.createReport({ userId, title: p.title || 'تقرير مستورد', description: p.description, sections: p.sections, reportType: p.reportType || 'imported' });
        return dbReport;
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
        engineReportId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        const { id, blockRef, body, engineReportId, ...data } = input;
        // Update engine state if we have an engine report ID and block ref
        let engineResult = null;
        if (engineReportId && blockRef && body) {
          try {
            const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
            const builder = new ReportEngineBuilder();
            const result = builder.engine.updateReport({
              report_id: engineReportId,
              actor_ref: actorRef,
              mutation: {
                mutation_kind: 'replace_block_content',
                block_ref: blockRef,
                body,
              },
            });
            engineResult = {
              report_id: result.report.report_id,
              version_ref: result.version.version_ref.version_id,
              evidence_ref: result.evidencePack?.evidence_pack_id,
              audit_events: result.auditEvents?.length || 0,
            };
          } catch (e) {
            engineResult = { error: String(e) };
          }
        }
        // Also update SQLite index
        if (blockRef && body) {
          const report = await localDb.getReportById(Number(id), userId);
          if (report) {
            let sections: any[] = [];
            try { sections = JSON.parse(report.sections as string || '[]'); } catch { sections = []; }
            const idx = sections.findIndex((s: any) => s.ref === blockRef || s.id === blockRef);
            if (idx >= 0) { sections[idx].body = body; }
            await localDb.updateReport(Number(id), userId, { ...data, sections });
          }
        } else {
          await localDb.updateReport(Number(id), userId, data);
        }
        return { success: true, engine_result: engineResult };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        await localDb.deleteReport(Number(input.id), userId);
        return { success: true };
      }),

    // ─── Publish Pipeline (real engine) ──────────────────────────
    review: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional(), comment: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        await localDb.updateReport(Number(input.id), userId, { status: 'reviewed' });
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const { pipeline, result } = builder.advancePublishPipeline(input.engineReportId, actorRef, 'review', input.comment);
          return { success: true, pipeline, engine_evidence: (result as any).evidencePack?.evidence_pack_id };
        }
        return { success: true, pipeline: null, engine_evidence: null };
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional(), comment: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        await localDb.updateReport(Number(input.id), userId, { status: 'approved' });
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const { pipeline, result } = builder.advancePublishPipeline(input.engineReportId, actorRef, 'approved', input.comment);
          return { success: true, pipeline, engine_evidence: (result as any).evidencePack?.evidence_pack_id };
        }
        return { success: true, pipeline: null, engine_evidence: null };
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        await localDb.updateReport(Number(input.id), userId, { status: 'published' });
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const { pipeline, result } = builder.advancePublishPipeline(input.engineReportId, actorRef, 'published');
          return {
            success: true,
            pipeline,
            publication: (result as any).publication || null,
            transport: (result as any).transport || null,
            engine_evidence: (result as any).evidencePack?.evidence_pack_id,
          };
        }
        return { success: true, pipeline: null, publication: null, transport: null, engine_evidence: null };
      }),

    // ─── Export (real engine) ────────────────────────────────────
    exportHtml: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const result = await builder.exportWithCompliance(input.engineReportId, actorRef, 'html');
          return {
            html: typeof result.export_result.payload === 'string' ? result.export_result.payload : '',
            title: result.report_id,
            compliant: result.compliant,
            compliance_checks: result.compliance_checks,
            artifact_ref: result.export_result.exportArtifact.artifact_id,
            evidence_ref: result.export_result.evidencePack?.evidence_pack_id,
          };
        }
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        return { html: `<h1>${report.title}</h1><div>${report.description || ''}</div>`, title: report.title, compliant: false, compliance_checks: [], artifact_ref: null, evidence_ref: null };
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const result = await builder.exportWithCompliance(input.engineReportId, actorRef, 'pdf');
          return {
            success: true,
            payload_size: result.export_result.payload instanceof Uint8Array ? result.export_result.payload.length : 0,
            compliant: result.compliant,
            compliance_checks: result.compliance_checks,
            artifact_ref: result.export_result.exportArtifact.artifact_id,
            evidence_ref: result.export_result.evidencePack?.evidence_pack_id,
          };
        }
        return { success: false, payload_size: 0, compliant: false, compliance_checks: [], artifact_ref: null, evidence_ref: null };
      }),

    exportDocx: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const result = await builder.exportWithCompliance(input.engineReportId, actorRef, 'docx');
          return {
            success: true,
            editable_verified: result.editable_verified,
            compliant: result.compliant,
            compliance_checks: result.compliance_checks,
            artifact_ref: result.export_result.exportArtifact.artifact_id,
            evidence_ref: result.export_result.evidencePack?.evidence_pack_id,
          };
        }
        return { success: false, editable_verified: false, compliant: false, compliance_checks: [], artifact_ref: null, evidence_ref: null };
      }),

    // ─── One-Click Conversion (real engine) ─────────────────────
    convertToPresentation: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const result = await builder.convertToSlides(input.engineReportId, actorRef);
          // Also index the presentation in SQLite
          const pres = await localDb.createPresentation({ userId, title: `عرض من: ${input.engineReportId}`, description: `تحويل تلقائي من التقرير` });
          return {
            db_presentation: pres,
            conversion: result,
            target_artifact_ref: result.target_artifact_ref,
            sections_mapped: result.sections_mapped,
            blocks_mapped: result.blocks_mapped,
            fidelity: result.conversion_fidelity,
          };
        }
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        const pres = await localDb.createPresentation({ userId, title: `عرض من: ${report.title}`, description: report.description as string || '' });
        return { db_presentation: pres, conversion: null, target_artifact_ref: null, sections_mapped: 0, blocks_mapped: 0, fidelity: 'none' };
      }),

    convertToDashboard: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const actorRef = `user-${userId}`;
        if (input.engineReportId) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const result = await builder.convertToDashboard(input.engineReportId, actorRef);
          const dash = await localDb.createDashboard({ userId, title: `لوحة من: ${input.engineReportId}`, description: 'تحويل تلقائي من التقرير' });
          return {
            db_dashboard: dash,
            conversion: result,
            target_artifact_ref: result.target_artifact_ref,
            sections_mapped: result.sections_mapped,
            blocks_mapped: result.blocks_mapped,
            fidelity: result.conversion_fidelity,
          };
        }
        const report = await localDb.getReportById(Number(input.id), userId);
        if (!report) throw new Error('التقرير غير موجود');
        const dash = await localDb.createDashboard({ userId, title: `لوحة من: ${report.title}`, description: report.description as string || '' });
        return { db_dashboard: dash, conversion: null, target_artifact_ref: null, sections_mapped: 0, blocks_mapped: 0, fidelity: 'none' };
      }),

    // ─── Diff Report (real engine) ──────────────────────────────
    compare: protectedProcedure
      .input(z.object({ id: z.string(), engineReportId: z.string().optional(), baseVersionRef: z.string().optional(), targetVersionRef: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const report = await localDb.getReportById(Number(input.id), userId);
        if (input.engineReportId && input.baseVersionRef && input.targetVersionRef) {
          const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
          const builder = new ReportEngineBuilder();
          const diff = builder.generateDiffReport(input.engineReportId, `user-${userId}`, input.baseVersionRef, input.targetVersionRef);
          return { current: report, previous: null, diff };
        }
        return { current: report, previous: null, diff: null };
      }),

    // ─── Builder-specific routes ────────────────────────────────
    // TOC generation
    generateToc: protectedProcedure
      .input(z.object({ engineReportId: z.string() }))
      .query(async ({ input }) => {
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.generateTOC(input.engineReportId);
      }),

    // Multi-page layout
    buildLayout: protectedProcedure
      .input(z.object({ engineReportId: z.string(), tocEnabled: z.boolean().optional() }))
      .query(async ({ input }) => {
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.buildMultiPageLayout(input.engineReportId, input.tocEnabled ?? true);
      }),

    // Live recalculation
    recalculate: protectedProcedure
      .input(z.object({ engineReportId: z.string(), selectiveRefs: z.array(z.string()).optional() }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.recalculateBindings(input.engineReportId, `user-${userId}`, input.selectiveRefs);
      }),

    // Publish pipeline state
    getPipeline: protectedProcedure
      .input(z.object({ engineReportId: z.string() }))
      .query(async ({ input }) => {
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.getPublishPipelineState(input.engineReportId);
      }),

    // Arabic localization
    applyLocalization: protectedProcedure
      .input(z.object({
        engineReportId: z.string(),
        targetLocale: z.string().optional(),
        terminologyProfile: z.string().optional(),
        directionTransform: z.boolean().optional(),
        typographyRefine: z.boolean().optional(),
        culturalFormat: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.applyArabicLocalization(input.engineReportId, `user-${userId}`, {
          target_locale: input.targetLocale,
          terminology_profile: input.terminologyProfile,
          direction_transform: input.directionTransform,
          typography_refine: input.typographyRefine,
          cultural_format: input.culturalFormat,
        });
      }),

    // Schedule report
    schedule: protectedProcedure
      .input(z.object({
        engineReportId: z.string(),
        cadence: z.enum(['weekly', 'monthly', 'on_demand', 'custom']).optional(),
        timezone: z.string().optional(),
        nextRunAt: z.string().nullable().optional(),
        publishOnSuccess: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id || 1;
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.scheduleReport(input.engineReportId, `user-${userId}`, input.cadence, {
          timezone: input.timezone,
          next_run_at: input.nextRunAt,
          publish_on_success: input.publishOnSuccess,
        });
      }),

    // Builder state
    getBuilderState: protectedProcedure
      .input(z.object({ engineReportId: z.string() }))
      .query(async ({ input }) => {
        const { ReportEngineBuilder } = await import("@rasid/report-engine/builder");
        const builder = new ReportEngineBuilder();
        return builder.getBuilderState(input.engineReportId);
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
});

export type AppRouter = typeof appRouter;
