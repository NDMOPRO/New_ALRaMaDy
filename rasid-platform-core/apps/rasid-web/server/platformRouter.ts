/**
 * Platform Router — tRPC procedures that proxy to the ALRaMaDy backend
 * 
 * This router exposes all backend engine capabilities as tRPC procedures,
 * making them available to the RASID frontend via the standard trpc.* hooks.
 * 
 * Each procedure maps to one or more REST endpoints on the unified gateway.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as platform from "./platformConnector";

// ─── AI Engine Router ────────────────────────────────────────────

const platformAIRouter = router({
  /** Submit an AI job to the platform engine */
  submitJob: protectedProcedure
    .input(z.object({
      pagePath: z.string(),
      sessionId: z.string(),
      prompt: z.string(),
      resourceRef: z.string().optional(),
      approvalGranted: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.submitAIJob({
        page_path: input.pagePath,
        session_id: input.sessionId,
        prompt: input.prompt,
        resource_ref: input.resourceRef,
        approval_granted: input.approvalGranted,
      });
      if (!result.ok) throw new Error(`AI job failed: ${JSON.stringify(result.data)}`);
      return result.data;
    }),

  /** List AI jobs for a session */
  listJobs: protectedProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ input }) => {
      const result = await platform.listAIJobs(input.sessionId);
      if (!result.ok) return { jobs: [] };
      return result.data;
    }),
});

// ─── Dashboard Engine Router ─────────────────────────────────────

const platformDashboardRouter = router({
  /** Create a new dashboard */
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      mode: z.enum(["easy", "advanced"]).optional(),
      datasetRefs: z.array(z.string()).optional(),
      templateId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = input.templateId
        ? await platform.createDashboardFromTemplate(input.templateId, input.datasetRefs || [])
        : await platform.createDashboard({
            title: input.title,
            mode: input.mode,
            dataset_refs: input.datasetRefs,
          });
      if (!result.ok) throw new Error(`Dashboard creation failed: ${JSON.stringify(result.data)}`);
      return result.data;
    }),

  /** Get dashboard state */
  getState: protectedProcedure
    .input(z.object({ dashboardId: z.string().optional() }))
    .query(async ({ input }) => {
      const result = await platform.getDashboardState(input.dashboardId);
      return result.data;
    }),

  /** Get dashboard versions */
  getVersions: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ input }) => {
      const result = await platform.getDashboardVersions(input.dashboardId);
      return result.data;
    }),

  /** Add widget to dashboard */
  addWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      widget: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.addDashboardWidget(input.dashboardId, input.widget);
      if (!result.ok) throw new Error(`Add widget failed`);
      return result.data;
    }),

  /** Move widget */
  moveWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      widgetRef: z.string(),
      position: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.moveDashboardWidget(input.dashboardId, input.widgetRef, input.position);
      if (!result.ok) throw new Error(`Move widget failed`);
      return result.data;
    }),

  /** Configure widget */
  configWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      widgetRef: z.string(),
      config: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.configDashboardWidget(input.dashboardId, input.widgetRef, input.config);
      if (!result.ok) throw new Error(`Config widget failed`);
      return result.data;
    }),

  /** Rebind widget data source */
  rebindWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      widgetRef: z.string(),
      datasetRef: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.rebindDashboardWidget(input.dashboardId, input.widgetRef, input.datasetRef);
      if (!result.ok) throw new Error(`Rebind widget failed`);
      return result.data;
    }),

  /** Refresh dashboard data */
  refresh: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.refreshDashboard(input.dashboardId);
      if (!result.ok) throw new Error(`Refresh failed`);
      return result.data;
    }),

  /** Compare dashboard versions */
  compare: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      versionA: z.string().optional(),
      versionB: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.compareDashboards(input.dashboardId, input.versionA, input.versionB);
      if (!result.ok) throw new Error(`Compare failed`);
      return result.data;
    }),

  /** Advanced compare */
  compareAdvanced: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      options: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.compareDashboardsAdvanced(input.dashboardId, input.options);
      if (!result.ok) throw new Error(`Advanced compare failed`);
      return result.data;
    }),

  /** Publish dashboard */
  publish: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.publishDashboard(input.dashboardId);
      if (!result.ok) throw new Error(`Publish failed`);
      return result.data;
    }),

  /** Share dashboard */
  share: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      options: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.shareDashboard(input.dashboardId, input.options);
      if (!result.ok) throw new Error(`Share failed`);
      return result.data;
    }),

  /** Schedule dashboard refresh */
  schedule: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      schedule: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.scheduleDashboard(input.dashboardId, input.schedule);
      if (!result.ok) throw new Error(`Schedule failed`);
      return result.data;
    }),

  /** Save dashboard as template */
  saveTemplate: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      name: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.saveDashboardTemplate(input.dashboardId, input.name);
      if (!result.ok) throw new Error(`Save template failed`);
      return result.data;
    }),

  /** List dashboard templates */
  getTemplates: protectedProcedure.query(async () => {
    const result = await platform.getDashboardTemplates();
    return result.data;
  }),

  /** Get dashboard library */
  getLibrary: protectedProcedure.query(async () => {
    const result = await platform.getDashboardLibrary();
    return result.data;
  }),

  /** Export widget to external target */
  exportWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      widgetRef: z.string(),
      targetKind: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.exportDashboardWidget(input.dashboardId, input.widgetRef, input.targetKind);
      if (!result.ok) throw new Error(`Export widget failed`);
      return result.data;
    }),

  /** Simulate design */
  simulateDesign: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      designParams: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.simulateDashboardDesign(input.dashboardId, input.designParams);
      if (!result.ok) throw new Error(`Simulate design failed`);
      return result.data;
    }),

  /** Save filter preset */
  saveFilterPreset: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      preset: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.saveDashboardFilterPreset(input.dashboardId, input.preset);
      if (!result.ok) throw new Error(`Save filter preset failed`);
      return result.data;
    }),

  /** Apply saved filter */
  applySavedFilter: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      filterId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.applySavedFilter(input.dashboardId, input.filterId);
      if (!result.ok) throw new Error(`Apply filter failed`);
      return result.data;
    }),

  /** Get saved filters */
  getSavedFilters: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ input }) => {
      const result = await platform.getSavedFilters(input.dashboardId);
      return result.data;
    }),

  /** Add page to dashboard */
  addPage: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      page: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.addDashboardPage(input.dashboardId, input.page);
      if (!result.ok) throw new Error(`Add page failed`);
      return result.data;
    }),
});

// ─── Report Engine Router ────────────────────────────────────────

const platformReportRouter = router({
  /** Create report from transcription */
  createFromTranscription: protectedProcedure
    .input(z.object({
      transcriptionJobId: z.string(),
      options: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.createReportFromTranscription(input.transcriptionJobId, input.options);
      if (!result.ok) throw new Error(`Create report from transcription failed`);
      return result.data;
    }),

  /** Convert report to dashboard */
  convertToDashboard: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.convertReportToDashboard(input.reportId);
      if (!result.ok) throw new Error(`Convert to dashboard failed`);
      return result.data;
    }),

  /** Convert report to presentation */
  convertToPresentation: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.convertReportToPresentation(input.reportId);
      if (!result.ok) throw new Error(`Convert to presentation failed`);
      return result.data;
    }),

  /** Create a report via platform gateway */
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      reportType: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.createReport({
        title: input.title,
        description: input.description || '',
        report_type: input.reportType || 'operational_report',
        language: input.language || 'ar-SA',
      });
      if (!result.ok) throw new Error(`Create report failed: ${JSON.stringify(result.data)}`);
      return result.data;
    }),

  /** Refresh report data bindings via platform */
  refresh: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.refreshReport(input.reportId);
      if (!result.ok) throw new Error(`Refresh report failed`);
      return result.data;
    }),

  /** Review report via platform pipeline */
  review: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.reviewReport(input.reportId);
      if (!result.ok) throw new Error(`Review report failed`);
      return result.data;
    }),

  /** Approve report via platform pipeline */
  approve: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.approveReport(input.reportId);
      if (!result.ok) throw new Error(`Approve report failed`);
      return result.data;
    }),

  /** Publish report via platform pipeline */
  publish: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.publishReport(input.reportId);
      if (!result.ok) throw new Error(`Publish report failed`);
      return result.data;
    }),

  /** Export report as HTML via platform */
  exportHtml: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.exportReportHtml(input.reportId);
      if (!result.ok) throw new Error(`Export HTML failed`);
      return result.data;
    }),

  /** Export report as PDF via platform */
  exportPdf: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.exportReportPdf(input.reportId);
      if (!result.ok) throw new Error(`Export PDF failed`);
      return result.data;
    }),

  /** Export report as DOCX via platform */
  exportDocx: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.exportReportDocx(input.reportId);
      if (!result.ok) throw new Error(`Export DOCX failed`);
      return result.data;
    }),

  /** Schedule report via platform */
  schedule: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.scheduleReport(input.reportId);
      if (!result.ok) throw new Error(`Schedule report failed`);
      return result.data;
    }),

  /** Compare report versions via platform */
  compare: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.compareReport(input.reportId);
      if (!result.ok) throw new Error(`Compare report failed`);
      return result.data;
    }),
});

// ─── Presentation Engine Router ──────────────────────────────────

const platformPresentationRouter = router({
  /** Create presentation from canvas data */
  createFromCanvas: protectedProcedure
    .input(z.object({
      canvasData: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.createPresentationFromCanvas(input.canvasData);
      if (!result.ok) throw new Error(`Create from canvas failed`);
      return result.data;
    }),

  /** Convert presentation to dashboard */
  convertToDashboard: protectedProcedure
    .input(z.object({ deckId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await platform.convertPresentationToDashboard(input.deckId);
      if (!result.ok) throw new Error(`Convert to dashboard failed`);
      return result.data;
    }),
});

// ─── Transcription Engine Router ─────────────────────────────────

const platformTranscriptionRouter = router({
  /** Start a transcription job */
  startJob: protectedProcedure
    .input(z.object({
      filePath: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.startTranscriptionJob({
        file_path: input.filePath,
        file_url: input.fileUrl,
        file_name: input.fileName,
        language: input.language,
      });
      if (!result.ok) throw new Error(`Transcription job failed`);
      return result.data;
    }),

  /** List transcription jobs */
  listJobs: protectedProcedure.query(async () => {
    const result = await platform.listTranscriptionJobs();
    return result.data;
  }),
});

// ─── Data Management Router ──────────────────────────────────────

const platformDataRouter = router({
  /** Register a new dataset */
  register: protectedProcedure
    .input(z.object({
      title: z.string(),
      sourceKind: z.string(),
      filePath: z.string().optional(),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
      fieldNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.registerDataset({
        title: input.title,
        source_kind: input.sourceKind,
        file_path: input.filePath,
        rows: input.rows,
        field_names: input.fieldNames,
      });
      if (!result.ok) throw new Error(`Dataset registration failed`);
      return result.data;
    }),

  /** List all datasets */
  list: protectedProcedure.query(async () => {
    const result = await platform.listDatasets();
    return result.data;
  }),

  /** Get canvas state */
  canvasState: protectedProcedure.query(async () => {
    const result = await platform.getCanvasState();
    return result.data;
  }),
});

// ─── Governance Engine Router ────────────────────────────────────

const platformGovernanceRouter = router({
  /** Get overall governance state */
  state: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceState();
    return result.data;
  }),

  /** List governance roles */
  roles: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceRoles();
    return result.data;
  }),

  /** Create a governance role */
  createRole: protectedProcedure
    .input(z.object({ role: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const result = await platform.createGovernanceRole(input.role);
      if (!result.ok) throw new Error(`Create role failed`);
      return result.data;
    }),

  /** Get role assignments */
  assignments: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceAssignments();
    return result.data;
  }),

  /** Get policies */
  policies: protectedProcedure.query(async () => {
    const result = await platform.getGovernancePolicies();
    return result.data;
  }),

  /** Get approval workflows */
  approvals: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceApprovals();
    return result.data;
  }),

  /** Get evidence records */
  evidence: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceEvidence();
    return result.data;
  }),

  /** Create evidence record */
  createEvidence: protectedProcedure
    .input(z.object({ evidence: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const result = await platform.createGovernanceEvidence(input.evidence);
      if (!result.ok) throw new Error(`Create evidence failed`);
      return result.data;
    }),

  /** Get audit trail */
  audit: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceAudit();
    return result.data;
  }),

  /** Get data lineage */
  lineage: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceLineage();
    return result.data;
  }),

  /** Get KPI definitions */
  kpis: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceKpis();
    return result.data;
  }),

  /** Get library records */
  library: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceLibrary();
    return result.data;
  }),

  /** Get compliance records */
  compliance: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceCompliance();
    return result.data;
  }),

  /** Run compliance check */
  checkCompliance: protectedProcedure
    .input(z.object({ payload: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const result = await platform.checkGovernanceCompliance(input.payload);
      if (!result.ok) throw new Error(`Compliance check failed`);
      return result.data;
    }),

  /** Scan AI prompt for governance */
  scanPrompt: protectedProcedure
    .input(z.object({ prompt: z.string(), context: z.string().optional() }))
    .mutation(async ({ input }) => {
      const result = await platform.scanGovernancePrompt(input.prompt, input.context);
      if (!result.ok) throw new Error(`Prompt scan failed`);
      return result.data;
    }),

  /** Get permissions */
  permissions: protectedProcedure.query(async () => {
    const result = await platform.getGovernancePermissions();
    return result.data;
  }),

  /** Get security surface */
  security: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceSecurity();
    return result.data;
  }),

  /** Get version records */
  versions: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceVersions();
    return result.data;
  }),

  /** Get diff artifacts */
  diffs: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceDiffs();
    return result.data;
  }),

  /** Get replay bundles */
  replays: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceReplays();
    return result.data;
  }),

  /** Get write paths */
  writePaths: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceWritePaths();
    return result.data;
  }),

  /** Get action registry */
  actionRegistry: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceActionRegistry();
    return result.data;
  }),

  /** Get tool registry */
  toolRegistry: protectedProcedure.query(async () => {
    const result = await platform.getGovernanceToolRegistry();
    return result.data;
  }),

  /** Get prompt scan history */
  promptScans: protectedProcedure.query(async () => {
    const result = await platform.getGovernancePromptScans();
    return result.data;
  }),
});

// ─── Localization Router ─────────────────────────────────────────

const platformLocalizationRouter = router({
  /** Localize a dashboard */
  localizeDashboard: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      targetLocale: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.localizeDashboard(input.dashboardId, input.targetLocale);
      if (!result.ok) throw new Error(`Localization failed`);
      return result.data;
    }),

  /** Live translation of text items */
  liveTranslation: protectedProcedure
    .input(z.object({
      sourceLocale: z.string(),
      targetLocale: z.string(),
      items: z.array(z.object({ nodeId: z.string(), text: z.string() })),
    }))
    .mutation(async ({ input }) => {
      const result = await platform.liveTranslation({
        source_locale: input.sourceLocale,
        target_locale: input.targetLocale,
        items: input.items.map(i => ({ node_id: i.nodeId, text: i.text })),
      });
      if (!result.ok) throw new Error(`Live translation failed`);
      return result.data;
    }),
});

// ─── Replication Router ──────────────────────────────────────────

const platformReplicationRouter = router({
  /** Consume strict replication output */
  consumeOutput: protectedProcedure
    .input(z.object({ payload: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const result = await platform.consumeReplicationOutput(input.payload);
      if (!result.ok) throw new Error(`Replication consumption failed`);
      return result.data;
    }),
});

// ─── Platform Health Router ──────────────────────────────────────

const platformHealthRouter = router({
  /** Check if the backend platform is reachable */
  check: publicProcedure.query(async () => {
    return platform.platformHealthCheck();
  }),

  /** Get the WebSocket URL for real-time updates */
  wsUrl: publicProcedure.query(() => {
    return { url: platform.getPlatformWebSocketUrl() };
  }),
});

// ─── Combined Platform Router ────────────────────────────────────

export const platformRouter = router({
  health: platformHealthRouter,
  ai: platformAIRouter,
  dashboards: platformDashboardRouter,
  reports: platformReportRouter,
  presentations: platformPresentationRouter,
  transcription: platformTranscriptionRouter,
  data: platformDataRouter,
  governance: platformGovernanceRouter,
  localization: platformLocalizationRouter,
  replication: platformReplicationRouter,
});
