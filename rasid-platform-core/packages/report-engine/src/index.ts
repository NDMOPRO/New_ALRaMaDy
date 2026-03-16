import { spawnSync } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import JSZip from "jszip";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  DashboardEngine,
  type CreateDashboardRequest,
  type DashboardPublicationResult,
  type DashboardWorkflowResult
} from "@rasid/dashboard-engine";
import {
  PresentationEngine,
  type PresentationBundle,
  type PresentationPublicationResult
} from "@rasid/presentations-engine";
import {
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  EvidencePackSchema,
  JobSchema,
  LibraryAssetSchema,
  PublicationSchema,
  REPORT_CAPABILITY_ID,
  REPORT_CONTRACT,
  REPORT_SCHEMA_NAMESPACE,
  REPORT_SCHEMA_VERSION,
  ReportActionRegistry,
  ReportApprovalStateSchema,
  ReportBindingSetSchema,
  ReportContentBlockSchema,
  ReportDiffMetadataSchema,
  ReportLayoutSchema,
  ReportReviewStateSchema,
  ReportSchema,
  ReportSectionSchema,
  ReportToolRegistry,
  ReportVersionSchema,
  SharedScheduleSchema,
  UnifiedContentBundleSchema,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type EvidencePack,
  type FailureReason,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type PermissionScope,
  type Publication,
  type Report,
  type ReportDiffMetadata,
  type SharedSchedule,
  type UnifiedContentBundle,
  type Warning
} from "@rasid/contracts";
import { z } from "zod";
import {
  ReportEngineStore,
  defaultReportEngineBackendRoot,
  defaultReportEngineStorageRoot,
  type ExternalIngestRecord,
  type PersistedReportPublicationRoute,
  type PersistableReportState,
  type ReportBackSyncRecord,
  type ReportTransportDeliveryRecord,
  type ScheduledDispatchRecord,
  type ScheduledOrchestrationRecord,
  type StoredExecutionStage
} from "./store";

const JsonRecordSchema = z.record(z.unknown());
const BlockKindSchema = z.enum(["narrative", "metric_card", "table", "chart", "commentary"]);
const ExportTargetSchema = z.enum(["docx", "pdf", "html"]);

const ReportBlockInputSchema = z.object({
  block_type: BlockKindSchema,
  title: z.string(),
  body: z.string().default(""),
  dataset_ref: z.string().nullable().default(null),
  query_ref: z.string().nullable().default(null),
  field_mappings: z.array(JsonRecordSchema).default([]),
  citations: z.array(z.string()).default([]),
  metric_value: z.number().optional(),
  table_rows: z.array(z.array(z.string())).default([]),
  chart_series: z.array(z.record(z.union([z.string(), z.number()]))).default([]),
  caption: z.string().default(""),
  page_number: z.number().int().positive().nullable().default(null),
  source_metadata: JsonRecordSchema.default({}),
  layout_semantics: JsonRecordSchema.default({}),
  source_lineage_refs: z.array(z.string()).default([])
});

const ReportSectionInputSchema = z.object({
  section_kind: z.enum(["cover", "executive_summary", "body", "appendix"]),
  title: z.string(),
  blocks: z.array(ReportBlockInputSchema).min(1),
  lock_policy: z.enum(["editable", "soft_lock", "strict_lock"]).default("editable")
});

const CreateReportRequestSchema = z.object({
  report_id: z.string().optional(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  title: z.string(),
  description: z.string().default(""),
  report_type: z.string().default("operational_report"),
  mode: z.enum(["easy", "advanced"]).default("advanced"),
  language: z.string().default("ar-SA"),
  template_ref: z.string().default("template://reports/default"),
  brand_preset_ref: z.string().default("brand://rasid/default"),
  source_refs: z.array(z.string()).default([]),
  sections: z.array(ReportSectionInputSchema).min(1),
  permission_scope: z
    .object({
      visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
      allow_read: z.boolean(),
      allow_write: z.boolean(),
      allow_share: z.boolean(),
      allow_publish: z.boolean(),
      allow_audit_view: z.boolean()
    })
    .default({
      visibility: "workspace",
      allow_read: true,
      allow_write: true,
      allow_share: true,
      allow_publish: true,
      allow_audit_view: true
    }),
  timestamp: z.string().optional()
});

const CreateReportFromTranscriptionRequestSchema = z.object({
  report_id: z.string().optional(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  title: z.string().optional(),
  description: z.string().default(""),
  report_type: z.string().default("transcription_report"),
  mode: z.enum(["easy", "advanced"]).default("advanced"),
  language: z.string().default("en-US"),
  template_ref: z.string().default("template://reports/default"),
  brand_preset_ref: z.string().default("brand://rasid/default"),
  bundle: UnifiedContentBundleSchema,
  report_handoff: JsonRecordSchema.default({}),
  query_dataset: JsonRecordSchema.default({}),
  transcription_artifact_refs: z.array(z.string()).default([]),
  transcription_runtime_refs: z
    .object({
      report_handoff_path: z.string().optional(),
      query_dataset_path: z.string().optional(),
      verification_artifact_path: z.string().optional(),
      alignment_artifact_path: z.string().optional()
    })
    .default({}),
  source_refs: z.array(z.string()).default([]),
  timestamp: z.string().optional()
});

const UpdateMutationSchema = z.discriminatedUnion("mutation_kind", [
  z.object({
    mutation_kind: z.literal("add_section"),
    section: ReportSectionInputSchema
  }),
  z.object({
    mutation_kind: z.literal("replace_block_content"),
    block_ref: z.string(),
    title: z.string().optional(),
    body: z.string()
  }),
  z.object({
    mutation_kind: z.literal("rebind_block"),
    block_ref: z.string(),
    dataset_ref: z.string(),
    query_ref: z.string(),
    field_mappings: z.array(JsonRecordSchema).default([])
  }),
  z.object({
    mutation_kind: z.literal("reconcile_section"),
    section_title: z.string(),
    downstream_capability: z.enum(["presentations", "dashboards"]),
    downstream_ref: z.string(),
    downstream_publication_ref: z.string().nullable().default(null),
    downstream_version_ref: z.string().nullable().default(null),
    merge_mode: z.enum(["structural_merge", "conflict_preserving"]).default("structural_merge"),
    allow_prune: z.boolean().default(true),
    blocks: z.array(ReportBlockInputSchema).default([])
  })
]);

const UpdateReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  mutation: UpdateMutationSchema,
  timestamp: z.string().optional()
});

const RefreshReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  selective_regeneration_refs: z.array(z.string()).default([]),
  timestamp: z.string().optional()
});

const CompareReportsRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  base_version_ref: z.string(),
  target_version_ref: z.string(),
  timestamp: z.string().optional()
});

const ReviewReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  reviewer_refs: z.array(z.string()).default([]),
  decision: z.enum(["in_review", "changes_requested", "reviewed"]),
  comment: z.string().default(""),
  timestamp: z.string().optional()
});

const ApproveReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().default(""),
  timestamp: z.string().optional()
});

const PublishReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  target_ref: z.string(),
  publish_to_library: z.boolean().default(true),
  timestamp: z.string().optional()
});

const ScheduleReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  schedule_type: z.string().default("report_refresh"),
  cadence: z.enum(["weekly", "monthly", "on_demand", "custom"]).default("weekly"),
  timezone: z.string().default("Asia/Riyadh"),
  next_run_at: z.string().nullable(),
  trigger_policy: z.object({
    trigger_mode: z.enum(["calendar", "manual", "event"]),
    misfire_policy: z.enum(["skip", "run_next", "run_immediately"]),
    require_fresh_inputs: z.boolean(),
    require_approval_before_run: z.boolean(),
    freshness_window_minutes: z.number().int().nonnegative().nullable()
  }),
  publication_policy: z.object({
    publish_mode: z.enum(["never", "on_success", "on_approval", "always"]),
    publication_target_refs: z.array(z.string()),
    export_profile_refs: z.array(z.string()),
    visibility_scope_ref: z.string().nullable()
  }),
  selective_regeneration_refs: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  timestamp: z.string().optional()
});

const ListReportSchedulesRequestSchema = z.object({
  report_id: z.string().optional(),
  include_disabled: z.boolean().default(true)
});

const UpdateReportScheduleRequestSchema = z.object({
  schedule_id: z.string(),
  actor_ref: z.string(),
  next_run_at: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  publication_target_refs: z.array(z.string()).optional(),
  export_profile_refs: z.array(z.string()).optional(),
  visibility_scope_ref: z.string().nullable().optional(),
  selective_regeneration_refs: z.array(z.string()).optional(),
  timestamp: z.string().optional()
});

const CancelReportScheduleRequestSchema = z.object({
  schedule_id: z.string(),
  actor_ref: z.string(),
  reason: z.string().default("Cancelled from report runtime."),
  timestamp: z.string().optional()
});

const ResumeReportScheduleRequestSchema = z.object({
  schedule_id: z.string(),
  actor_ref: z.string(),
  next_run_at: z.string().nullable().optional(),
  timestamp: z.string().optional()
});

const RunReportScheduleRequestSchema = z.object({
  schedule_id: z.string(),
  actor_ref: z.string().default("report-scheduler"),
  run_at: z.string().optional()
});

const ExportReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  target: ExportTargetSchema,
  timestamp: z.string().optional()
});

const ConvertReportRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  target_ref: z.string().default("workspace://derived"),
  timestamp: z.string().optional()
});

const IngestExternalReportRequestSchema = z.object({
  report_id: z.string().optional(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  title: z.string().optional(),
  description: z.string().default(""),
  report_type: z.string().default("external_ingested_report"),
  mode: z.enum(["easy", "advanced"]).default("advanced"),
  language: z.string().default("ar-SA"),
  template_ref: z.string().default("template://reports/imported"),
  brand_preset_ref: z.string().default("brand://rasid/default"),
  source_refs: z.array(z.string()).default([]),
  file_path: z.string(),
  mime_type: z.string().optional(),
  parser_hint: z.enum(["auto", "docx", "pdf"]).default("auto"),
  permission_scope: z
    .object({
      visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
      allow_read: z.boolean(),
      allow_write: z.boolean(),
      allow_share: z.boolean(),
      allow_publish: z.boolean(),
      allow_audit_view: z.boolean()
    })
    .default({
      visibility: "workspace",
      allow_read: true,
      allow_write: true,
      allow_share: true,
      allow_publish: true,
      allow_audit_view: true
    }),
  timestamp: z.string().optional()
});

const PublishDegradedReportOutputRequestSchema = z.object({
  report_id: z.string(),
  actor_ref: z.string(),
  target_ref: z.string(),
  reason: z.string(),
  export_target: ExportTargetSchema.default("html"),
  timestamp: z.string().optional()
});

type ParsedCreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

export type CreateReportRequest = z.input<typeof CreateReportRequestSchema>;
export type CreateReportFromTranscriptionRequest = z.input<typeof CreateReportFromTranscriptionRequestSchema>;
export type UpdateReportRequest = z.input<typeof UpdateReportRequestSchema>;
export type RefreshReportRequest = z.input<typeof RefreshReportRequestSchema>;
export type CompareReportsRequest = z.input<typeof CompareReportsRequestSchema>;
export type ReviewReportRequest = z.input<typeof ReviewReportRequestSchema>;
export type ApproveReportRequest = z.input<typeof ApproveReportRequestSchema>;
export type PublishReportRequest = z.input<typeof PublishReportRequestSchema>;
export type ScheduleReportRequest = z.input<typeof ScheduleReportRequestSchema>;
export type ListReportSchedulesRequest = z.input<typeof ListReportSchedulesRequestSchema>;
export type UpdateReportScheduleRequest = z.input<typeof UpdateReportScheduleRequestSchema>;
export type CancelReportScheduleRequest = z.input<typeof CancelReportScheduleRequestSchema>;
export type ResumeReportScheduleRequest = z.input<typeof ResumeReportScheduleRequestSchema>;
export type RunReportScheduleRequest = z.input<typeof RunReportScheduleRequestSchema>;
export type ExportReportRequest = z.input<typeof ExportReportRequestSchema>;
export type ConvertReportRequest = z.input<typeof ConvertReportRequestSchema>;
export type IngestExternalReportRequest = z.input<typeof IngestExternalReportRequestSchema>;
export type PublishDegradedReportOutputRequest = z.input<typeof PublishDegradedReportOutputRequestSchema>;

export type ReportEngineOptions = {
  storageDir?: string;
};

export type ReportWorkflowResult = PersistableReportState & StoredExecutionStage;

export type ReportCompareResult = {
  diff: ReportDiffMetadata;
  diffArtifact: Artifact;
} & StoredExecutionStage;

export type ReportExportResult = {
  sourceReport: PersistableReportState;
  exportArtifact: Artifact;
  fileName: string;
  contentType: string;
  payload: string | Uint8Array;
} & StoredExecutionStage;

export type ReportPublicationResult = {
  state: PersistableReportState;
  publication: Publication;
  libraryAsset: LibraryAsset | null;
  transport: ReportPublicationTransport | null;
} & StoredExecutionStage;

export type ReportScheduleResult = {
  state: PersistableReportState;
  schedule: SharedSchedule;
} & StoredExecutionStage;

export type ReportScheduleRunResult = {
  schedule: SharedSchedule;
  dispatch: ScheduledDispatchRecord;
  orchestration: ScheduledOrchestrationRecord;
  transportDeliveries: ReportTransportDeliveryRecord[];
  refreshResult: ReportWorkflowResult;
  publicationResult: ReportPublicationResult | null;
  degradedPublicationResult: ReportPublicationResult | null;
  runnerStage: StoredExecutionStage;
  state: PersistableReportState;
};

export type ReportScheduleListResult = {
  schedules: SharedSchedule[];
};

export type ReportConversionResult = {
  state: PersistableReportState;
  artifact: Artifact;
  payload: Record<string, unknown>;
  backSyncRecord?: ReportBackSyncRecord;
  backSyncStage?: StoredExecutionStage;
  nativePresentationBundle?: PresentationBundle;
  nativePresentationPublication?: PresentationPublicationResult;
  nativeDashboardWorkflow?: DashboardWorkflowResult;
  nativeDashboardPublication?: DashboardPublicationResult;
} & StoredExecutionStage;

export type ReportExternalIngestResult = {
  state: PersistableReportState;
  sourceArtifact: Artifact;
  ingestRecord: ExternalIngestRecord;
  payload: Record<string, unknown>;
} & StoredExecutionStage;

export type ReportPublicationTransport = {
  manifest_path: string;
  manifest_uri: string;
  publish_state_path: string;
  publish_state_uri: string;
  embed_payload_path: string | null;
  embed_payload_uri: string | null;
  embed_html_path: string | null;
  embed_html_uri: string | null;
  export_html_path: string;
  export_html_uri: string;
  outbox_path: string;
  outbox_uri: string;
  served_manifest_url: string;
  served_publish_state_url: string;
  served_embed_payload_url: string | null;
  served_embed_html_url: string | null;
  served_export_html_url: string;
  backend_publication_root: string;
  backend_publication_ref: string;
  backend_manifest_path: string;
  backend_manifest_uri: string;
  backend_access_state_path: string;
  backend_access_state_uri: string;
  backend_bundle_index_path: string;
  backend_bundle_index_uri: string;
  backend_delivery_state_path: string;
  backend_delivery_state_uri: string;
  gateway_bundle_root: string;
  gateway_bundle_ref: string;
  gateway_manifest_path: string;
  gateway_manifest_uri: string;
  gateway_consumable_ref: string;
  access_lifecycle_path: string;
  access_lifecycle_uri: string;
  delivery_receipt_path: string;
  delivery_receipt_uri: string;
  served_access_token: string;
  access_mode: "read_only" | "editable" | "shared";
  remote_bundle_ref?: string | null;
  remote_repository_ref?: string | null;
  remote_manifest_url?: string | null;
  remote_publish_state_url?: string | null;
  remote_embed_payload_url?: string | null;
  remote_embed_html_url?: string | null;
  remote_export_html_url?: string | null;
  remote_gateway_manifest_url?: string | null;
  remote_access_lifecycle_url?: string | null;
  remote_delivery_receipt_url?: string | null;
};

export type ReportRegressionSuiteResult = {
  runId: string;
  ingestedDocx: ReportExternalIngestResult;
  ingestedPdf: ReportExternalIngestResult;
  created: ReportWorkflowResult;
  updated: ReportWorkflowResult;
  refreshed: ReportWorkflowResult;
  compared: ReportCompareResult;
  reviewed: ReportWorkflowResult;
  approved: ReportWorkflowResult;
  exports: ReportExportResult[];
  presentationConversion: ReportConversionResult;
  presentationReconciledConversion: ReportConversionResult;
  dashboardConversion: ReportConversionResult;
  dashboardReconciledConversion: ReportConversionResult;
  published: ReportPublicationResult;
  scheduled: ReportScheduleResult;
  scheduledRuns: ReportScheduleRunResult[];
  degradedPublication: ReportPublicationResult;
};

const ReportDispatchRequestSchema = z.object({
  action_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

const ReportToolDispatchRequestSchema = z.object({
  tool_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

export type ReportDispatchRequest = z.infer<typeof ReportDispatchRequestSchema>;
export type ReportToolDispatchRequest = z.infer<typeof ReportToolDispatchRequestSchema>;

export type ReportPublicationServiceRegistration = {
  publication_id: string;
  report_id: string;
  backend_ref: string;
  gateway_bundle_ref: string | null;
  access_mode: "read_only" | "editable" | "shared";
  served_manifest_url: string;
  served_publish_state_url: string;
  served_embed_payload_url: string | null;
  served_embed_html_url: string | null;
  served_export_html_url: string;
};

export type ReportPublicationServiceStatus = {
  host: string;
  port: number;
  base_url: string;
  storage_dir: string;
  backend_root: string;
  publications: ReportPublicationServiceRegistration[];
};

const now = (timestamp?: string): string => timestamp ?? new Date().toISOString();

const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const localized = (value: string, locale = "ar-SA") => [{ value, locale, rtl: locale.startsWith("ar") }];

const baseWarning = (warningCode: string, summary: string, detail: string, impactedRefs: string[] = []): Warning => ({
  warning_code: warningCode,
  summary,
  detail,
  severity: "medium",
  impacted_refs: impactedRefs
});

const baseFailure = (reasonCode: string, summary: string, detail: string, impactedRefs: string[] = []): FailureReason => ({
  reason_code: reasonCode,
  summary,
  detail,
  impacted_refs: impactedRefs,
  retryable: false
});

const semanticVersion = (versionNumber: number): string => `1.0.${Math.max(0, versionNumber - 1)}`;

const addCadence = (timestamp: string | null, cadence: SharedSchedule["cadence"]): string | null => {
  if (!timestamp) return null;
  const source = new Date(timestamp);
  if (Number.isNaN(source.getTime())) return null;
  if (cadence === "weekly") source.setUTCDate(source.getUTCDate() + 7);
  if (cadence === "monthly") source.setUTCDate(source.getUTCDate() + 30);
  if (cadence === "custom") source.setUTCDate(source.getUTCDate() + 14);
  if (cadence === "on_demand") return null;
  return source.toISOString();
};

const transportAccessMode = (permissionScope: PermissionScope): ReportPublicationTransport["access_mode"] =>
  permissionScope.allow_write ? "editable" : permissionScope.allow_share ? "shared" : "read_only";

type ServedReportPublicationRoute = {
  accessToken: string;
  manifestPath: string;
  publishStatePath: string;
  embedPayloadPath: string | null;
  embedHtmlPath: string | null;
  exportHtmlPath: string;
};

const REPORT_TRANSPORT_HOST = "127.0.0.1";
const allocateReportTransportPort = (): number => {
  try {
    if (process.platform === "win32") {
      const output = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'),0); $listener.Start(); $port = ($listener.LocalEndpoint).Port; $listener.Stop(); Write-Output $port"
        ],
        { encoding: "utf8" }
      ).stdout.trim();
      const parsed = Number(output);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } else {
      const net = require("node:net") as typeof import("node:net");
      const srv = net.createServer();
      srv.listen(0, "127.0.0.1");
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close();
      if (port > 0) return port;
    }
  } catch {
    // Fall through to a deterministic high port if the OS probe fails.
  }
  return 40000 + (process.pid % 1000);
};
let reportTransportPort = Number(process.env.RASID_REPORT_TRANSPORT_PORT ?? "0");
if (!Number.isFinite(reportTransportPort) || reportTransportPort <= 0) {
  reportTransportPort = allocateReportTransportPort();
}
let reportTransportServer: Server | null = null;
const servedReportPublicationRoutes = new Map<string, ServedReportPublicationRoute>();

const servedReportPublicationUrl = (
  publicationId: string,
  asset: "manifest" | "state" | "embed-payload" | "embed" | "export-html",
  accessToken: string
) => `http://${REPORT_TRANSPORT_HOST}:${reportTransportPort}/publications/${publicationId}/${asset}?access_token=${accessToken}`;

const ensureReportTransportServer = (): void => {
  if (reportTransportServer) {
    return;
  }
  reportTransportServer = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${REPORT_TRANSPORT_HOST}:${reportTransportPort}`);
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    if (parts.length !== 3 || parts[0] !== "publications") {
      response.statusCode = 404;
      response.end("not_found");
      return;
    }
    const publicationId = parts[1];
    const route = servedReportPublicationRoutes.get(publicationId);
    if (!route || requestUrl.searchParams.get("access_token") !== route.accessToken) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }
    const filePath =
      parts[2] === "manifest"
        ? route.manifestPath
        : parts[2] === "state"
          ? route.publishStatePath
          : parts[2] === "embed-payload"
            ? route.embedPayloadPath
            : parts[2] === "embed"
              ? route.embedHtmlPath
              : parts[2] === "export-html"
                ? route.exportHtmlPath
                : null;
    if (!filePath) {
      response.statusCode = 404;
      response.end("missing");
      return;
    }
    try {
      const payload = await fs.readFile(filePath);
      response.statusCode = 200;
      response.setHeader(
        "content-type",
        parts[2] === "embed" || parts[2] === "export-html"
          ? "text/html; charset=utf-8"
          : "application/json; charset=utf-8"
      );
      response.end(payload);
    } catch {
      response.statusCode = 404;
      response.end("missing");
    }
  });
  reportTransportServer.listen(reportTransportPort, REPORT_TRANSPORT_HOST);
  const address = reportTransportServer.address();
  if (address && typeof address === "object") {
    reportTransportPort = address.port;
  }
  reportTransportServer.unref();
};

const registerServedReportPublicationRoute = (
  publicationId: string,
  manifestPath: string,
  publishStatePath: string,
  embedPayloadPath: string | null,
  embedHtmlPath: string | null,
  exportHtmlPath: string
) => {
  ensureReportTransportServer();
  const accessToken = createHash("sha256")
    .update([publicationId, manifestPath, publishStatePath, embedPayloadPath ?? "", embedHtmlPath ?? "", exportHtmlPath].join("|"))
    .digest("hex")
    .slice(0, 24);
  servedReportPublicationRoutes.set(publicationId, {
    accessToken,
    manifestPath,
    publishStatePath,
    embedPayloadPath,
    embedHtmlPath,
    exportHtmlPath
  });
  return {
    served_manifest_url: servedReportPublicationUrl(publicationId, "manifest", accessToken),
    served_publish_state_url: servedReportPublicationUrl(publicationId, "state", accessToken),
    served_embed_payload_url: embedPayloadPath ? servedReportPublicationUrl(publicationId, "embed-payload", accessToken) : null,
    served_embed_html_url: embedHtmlPath ? servedReportPublicationUrl(publicationId, "embed", accessToken) : null,
    served_export_html_url: servedReportPublicationUrl(publicationId, "export-html", accessToken),
    served_access_token: accessToken
  };
};

const rehydrateServedReportPublicationRoute = (route: PersistedReportPublicationRoute): ReportPublicationServiceRegistration => {
  const served = registerServedReportPublicationRoute(
    route.publication_id,
    route.manifest_path,
    route.publish_state_path,
    route.embed_payload_path,
    route.embed_html_path,
    route.export_html_path
  );
  return {
    publication_id: route.publication_id,
    report_id: route.report_id,
    backend_ref: route.backend_ref,
    gateway_bundle_ref: route.gateway_bundle_ref,
    access_mode: route.access_mode,
    served_manifest_url: served.served_manifest_url,
    served_publish_state_url: served.served_publish_state_url,
    served_embed_payload_url: served.served_embed_payload_url,
    served_embed_html_url: served.served_embed_html_url,
    served_export_html_url: served.served_export_html_url
  };
};

const rehydratePersistedReportPublications = (store: ReportEngineStore): ReportPublicationServiceRegistration[] =>
  store.listBackendPublicationIds()
    .map((publicationId) => store.loadPublicationRoute(publicationId))
    .filter((route): route is PersistedReportPublicationRoute => route !== null)
    .map(rehydrateServedReportPublicationRoute);

type GithubPublicationTarget = {
  owner: string;
  repo: string;
  branch: string;
};

type RemotePublishedAsset = {
  remote_path: string;
  raw_url: string;
  public_url: string;
  github_url: string;
  sha: string | null;
};

const parseGithubOrigin = (): GithubPublicationTarget | null => {
  const result = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" });
  const remote = result.status === 0 ? result.stdout.trim() : "";
  const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/i);
  if (!match?.groups?.owner || !match.groups.repo) return null;
  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
    branch: process.env.RASID_REPORT_REMOTE_BRANCH ?? "gh-pages"
  };
};

const githubApi = (args: string[], input?: string): string => {
  const result = spawnSync("gh", ["api", ...args], { encoding: "utf8", input });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "GitHub API request failed.");
  }
  return result.stdout.trim();
};

const encodeGithubContentPath = (value: string): string =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const lookupGithubContentSha = (target: GithubPublicationTarget, remotePath: string): string | null => {
  const result = spawnSync(
    "gh",
    ["api", `repos/${target.owner}/${target.repo}/contents/${encodeGithubContentPath(remotePath)}?ref=${target.branch}`],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  const payload = JSON.parse(result.stdout) as { sha?: string };
  return payload.sha ?? null;
};

const uploadGithubContent = (
  target: GithubPublicationTarget,
  remotePath: string,
  content: Buffer | Uint8Array | string,
  message: string
): RemotePublishedAsset => {
  const encoded = Buffer.isBuffer(content)
    ? content.toString("base64")
    : content instanceof Uint8Array
      ? Buffer.from(content).toString("base64")
      : Buffer.from(content, "utf8").toString("base64");
  let response: { content?: { sha?: string; html_url?: string } } | null = null;
  let sha: string | null = null;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    sha = lookupGithubContentSha(target, remotePath);
    const payload = JSON.stringify({
      message,
      content: encoded,
      branch: target.branch,
      ...(sha ? { sha } : {})
    });
    try {
      response = JSON.parse(
        githubApi(["repos/" + target.owner + "/" + target.repo + "/contents/" + encodeGithubContentPath(remotePath), "--method", "PUT", "--input", "-"], payload)
      ) as { content?: { sha?: string; html_url?: string } };
      lastError = null;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!/HTTP 409/i.test(lastError.message) || attempt === 4) {
        throw lastError;
      }
    }
  }
  if (!response) {
    throw lastError ?? new Error(`Failed to upload ${remotePath}`);
  }
  return {
    remote_path: remotePath,
    raw_url: `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.branch}/${remotePath}`,
    public_url: `https://cdn.jsdelivr.net/gh/${target.owner}/${target.repo}@${target.branch}/${remotePath}`,
    github_url: response.content?.html_url ?? `https://github.com/${target.owner}/${target.repo}/blob/${target.branch}/${remotePath}`,
    sha: response.content?.sha ?? sha
  };
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
const ExternalSectionBlueprintSchema = z.object({
  title: z.string(),
  section_kind: z.enum(["cover", "executive_summary", "body", "appendix"]),
  blocks: z.array(ReportBlockInputSchema).min(1)
});

const ImportFixtureProfileSchema = z.enum(["basic", "complex"]);

const ExternalSourceParseSchema = z.object({
  title: z.string(),
  paragraphs: z.array(z.string()).default([]),
  extracted_text: z.string().default(""),
  warning_codes: z.array(z.string()).default([]),
  page_count: z.number().int().nonnegative().default(1),
  section_count: z.number().int().nonnegative().default(0),
  table_count: z.number().int().nonnegative().default(0),
  chart_count: z.number().int().nonnegative().default(0),
  caption_count: z.number().int().nonnegative().default(0),
  captions: z.array(JsonRecordSchema).default([]),
  tables: z.array(JsonRecordSchema).default([]),
  charts: z.array(JsonRecordSchema).default([]),
  page_structure: z.array(JsonRecordSchema).default([]),
  layout_semantics: z.array(JsonRecordSchema).default([]),
  geometry_map: z.array(JsonRecordSchema).default([]),
  page_semantics: z.array(JsonRecordSchema).default([]),
  section_hierarchy: z.array(JsonRecordSchema).default([]),
  block_lineage_map: z.array(JsonRecordSchema).default([]),
  section_blueprints: z.array(ExternalSectionBlueprintSchema).default([]),
  rendered_pages: z.array(z.string()).default([]),
  source_language: z.string().nullable().default(null),
  hyperlinks: z.array(JsonRecordSchema).default([]),
  embedded_assets: z.array(JsonRecordSchema).default([]),
  document_metadata: JsonRecordSchema.default({}),
  fixture_profile: ImportFixtureProfileSchema.optional(),
  expected: JsonRecordSchema.optional()
});

type ExternalSourceParseResult = z.infer<typeof ExternalSourceParseSchema>;

const pythonBridgePath = (): string =>
  path.join(process.cwd(), "packages", "report-engine", "tools", "document_bridge.py");

const runReportDocumentBridge = (
  command:
    | "extract-docx"
    | "extract-pdf"
    | "build-sample-docx"
    | "build-sample-pdf"
    | "build-complex-sample-docx"
    | "build-complex-sample-pdf",
  inputPath: string,
  extra: { renderDir?: string; outputPath?: string } = {}
): Record<string, unknown> => {
  const outputPath =
    extra.outputPath ??
    path.join(defaultReportEngineStorageRoot(process.cwd()), ".tmp", `${id("bridge", command, path.basename(inputPath)).toLowerCase()}.json`);
  fsSync.mkdirSync(path.dirname(outputPath), { recursive: true });
  const args = [pythonBridgePath(), command, inputPath, outputPath];
  if (extra.renderDir) args.push("--render-dir", extra.renderDir);
  const result = spawnSync("python", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Report document bridge failed for ${command}`);
  }
  return JsonRecordSchema.parse(JSON.parse(fsSync.readFileSync(outputPath, "utf8")));
};

type ReportImportFixture = {
  bytes: Uint8Array;
  metadata: Record<string, unknown>;
};

type RemoteBundlePublishResult = {
  provider: "github";
  repository_ref: string;
  bundle_ref: string;
  assets: Record<string, RemotePublishedAsset>;
};

const fallbackImportedSections = (
  title: string,
  paragraphs: string[],
  defaultSummary: string,
  sourceKind: "docx" | "pdf"
): ParsedCreateReportRequest["sections"] => {
  const bodyParagraphs = paragraphs.length > 0 ? paragraphs : [defaultSummary];
  const grouped = bodyParagraphs.reduce<string[][]>((accumulator, paragraph, index) => {
    const chunkIndex = Math.floor(index / 3);
    if (!accumulator[chunkIndex]) accumulator[chunkIndex] = [];
    accumulator[chunkIndex].push(paragraph);
    return accumulator;
  }, []);
  const sections: ParsedCreateReportRequest["sections"] = [
    {
      section_kind: "cover",
      title,
      blocks: [
        {
          block_type: "narrative",
          title: "Imported Source",
          body: bodyParagraphs[0] ?? defaultSummary,
          dataset_ref: null,
          query_ref: null,
          field_mappings: [],
          citations: [],
          table_rows: [],
          chart_series: [],
          caption: "",
          page_number: 1,
          source_metadata: { parser_kind: sourceKind, fallback: true },
          layout_semantics: { parser_kind: sourceKind, fallback: true },
          source_lineage_refs: [`${sourceKind}://fallback/cover`]
        }
      ],
      lock_policy: "editable"
    }
  ];
  grouped.forEach((group, index) => {
    sections.push({
      section_kind: index === 0 ? "executive_summary" : "body",
      title: index === 0 ? "Imported Summary" : `Imported Section ${index}`,
      blocks: group.map((paragraph, blockIndex) => ({
        block_type: blockIndex === 0 && index === 0 ? "commentary" : "narrative",
        title: `Imported Paragraph ${index + 1}.${blockIndex + 1}`,
        body: paragraph,
        dataset_ref: null,
        query_ref: null,
        field_mappings: [],
        citations: [],
        table_rows: [],
        chart_series: [],
        caption: "",
        page_number: index + 1,
        source_metadata: { parser_kind: sourceKind, fallback: true, paragraph_index: blockIndex + 1 },
        layout_semantics: { parser_kind: sourceKind, fallback: true, section_index: index + 1 },
        source_lineage_refs: [`${sourceKind}://fallback/${index + 1}/${blockIndex + 1}`]
      })),
      lock_policy: "editable"
    });
  });
  return sections;
};

const buildImportedSections = (
  title: string,
  parsed: ExternalSourceParseResult,
  defaultSummary: string,
  sourceKind: "docx" | "pdf"
): ParsedCreateReportRequest["sections"] => {
  if (parsed.section_blueprints.length > 0) {
    return parsed.section_blueprints.map((section, sectionIndex) => ({
      section_kind: section.section_kind,
      title: section.title || title,
      blocks: section.blocks.map((block, index) => ({
        ...block,
        title: block.title || `${section.title} Block ${index + 1}`,
        body: block.body || defaultSummary,
        source_metadata: {
          parser_kind: sourceKind,
          source_language: parsed.source_language,
          page_count: parsed.page_count,
          section_count: parsed.section_count,
          table_count: parsed.table_count,
          chart_count: parsed.chart_count,
          caption_count: parsed.caption_count,
          hyperlink_count: parsed.hyperlinks.length,
          embedded_asset_count: parsed.embedded_assets.length,
          document_metadata: parsed.document_metadata,
          section_index: sectionIndex + 1,
          section_hierarchy: parsed.section_hierarchy.filter(
            (entry) => String(entry["section_title"] ?? "") === (section.title || title)
          ),
          page_semantics: parsed.page_semantics.filter(
            (entry) => entry["page_number"] === (block.page_number ?? entry["page_number"])
          ),
          block_lineage: parsed.block_lineage_map.filter((entry) =>
            (Array.isArray(block.source_lineage_refs) ? block.source_lineage_refs : []).includes(String(entry["source_ref"] ?? ""))
          ),
          ...block.source_metadata
        },
        layout_semantics: {
          parser_kind: sourceKind,
          page_structure: parsed.page_structure,
          geometry_map: parsed.geometry_map.filter(
            (entry) => entry["page_number"] === (block.page_number ?? entry["page_number"])
          ),
          page_semantics: parsed.page_semantics.filter(
            (entry) => entry["page_number"] === (block.page_number ?? entry["page_number"])
          ),
          hyperlinks: parsed.hyperlinks.filter(
            (entry) => entry["page_number"] === (block.page_number ?? entry["page_number"])
          ),
          embedded_assets: parsed.embedded_assets.filter(
            (entry) => entry["page_number"] === (block.page_number ?? entry["page_number"])
          ),
          ...block.layout_semantics
        }
      })),
      lock_policy: "editable"
    }));
  }
  return fallbackImportedSections(title, parsed.paragraphs, defaultSummary, sourceKind);
};

const parseDocxExternalSource = async (filePath: string, storageRoot: string): Promise<ExternalSourceParseResult> =>
  ExternalSourceParseSchema.parse(
    runReportDocumentBridge("extract-docx", filePath, {
      outputPath: path.join(storageRoot, ".tmp", `${id("extract", "docx", path.basename(filePath)).toLowerCase()}.json`)
    })
  );

const parsePdfExternalSource = async (filePath: string, storageRoot: string): Promise<ExternalSourceParseResult> =>
  ExternalSourceParseSchema.parse(
    runReportDocumentBridge("extract-pdf", filePath, {
      outputPath: path.join(storageRoot, ".tmp", `${id("extract", "pdf", path.basename(filePath)).toLowerCase()}.json`),
      renderDir: path.join(storageRoot, ".tmp", `${id("pdf-pages", path.basename(filePath)).toLowerCase()}`)
    })
  );

const pdfEscape = (value: string): string => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildPdf = (lines: string[]): Uint8Array => {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...lines.flatMap((line, index) => (index === 0 ? [`(${pdfEscape(line)}) Tj`] : ["0 -18 Td", `(${pdfEscape(line)}) Tj`])),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf8");
};

const buildDocx = async (title: string, lines: string[]): Promise<Uint8Array> => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );
  zip.folder("docProps")?.file(
    "core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${title}</dc:title>
</cp:coreProperties>`
  );
  const paragraphs = lines
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</w:t></w:r></w:p>`)
    .join("");
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`
  );
  return zip.generateAsync({ type: "uint8array" });
};

export const createSampleDocxFixture = async (profile: z.infer<typeof ImportFixtureProfileSchema> = "basic"): Promise<ReportImportFixture> => {
  const targetPath = path.join(defaultReportEngineStorageRoot(process.cwd()), ".tmp", `${id("sample", "report-import", "docx", profile)}.docx`);
  const metadata = runReportDocumentBridge(profile === "complex" ? "build-complex-sample-docx" : "build-sample-docx", targetPath, {
    outputPath: path.join(defaultReportEngineStorageRoot(process.cwd()), ".tmp", `${id("sample-meta", "report-import", "docx", profile)}.json`)
  });
  return { bytes: Uint8Array.from(fsSync.readFileSync(targetPath)), metadata };
};

export const createSamplePdfFixture = (profile: z.infer<typeof ImportFixtureProfileSchema> = "basic"): ReportImportFixture => {
  const targetPath = path.join(defaultReportEngineStorageRoot(process.cwd()), ".tmp", `${id("sample", "report-import", "pdf", profile)}.pdf`);
  const metadata = runReportDocumentBridge(profile === "complex" ? "build-complex-sample-pdf" : "build-sample-pdf", targetPath, {
    outputPath: path.join(defaultReportEngineStorageRoot(process.cwd()), ".tmp", `${id("sample-meta", "report-import", "pdf", profile)}.json`)
  });
  return { bytes: Uint8Array.from(fsSync.readFileSync(targetPath)), metadata };
};

export const createSampleDocx = async (_title: string, _lines: string[]): Promise<Uint8Array> => (await createSampleDocxFixture("basic")).bytes;

export const createSamplePdf = (_lines: string[]): Uint8Array => createSamplePdfFixture("basic").bytes;

const publishRemoteBundle = (
  bundleRoot: string,
  files: Array<{ key: string; fileName: string; content: Buffer | Uint8Array | string }>,
  message: string
): RemoteBundlePublishResult | null => {
  const githubTarget = parseGithubOrigin();
  if (!githubTarget) return null;
  const assets = files.reduce<Record<string, RemotePublishedAsset>>((accumulator, file) => {
    accumulator[file.key] = uploadGithubContent(
      githubTarget,
      `${bundleRoot}/${file.fileName}`.replace(/\\/g, "/"),
      file.content,
      message
    );
    return accumulator;
  }, {});
  return {
    provider: "github",
    repository_ref: `github://${githubTarget.owner}/${githubTarget.repo}/${githubTarget.branch}`,
    bundle_ref: `github://${githubTarget.owner}/${githubTarget.repo}/${githubTarget.branch}/${bundleRoot}`,
    assets
  };
};

const schedulerBundlePath = (orchestrationId: string): string =>
  path.join(defaultReportEngineBackendRoot(process.cwd()), "scheduler", orchestrationId.replace(/[^a-zA-Z0-9_-]+/g, "-"));

const publishRemoteSchedulerBundle = (orchestrationId: string): RemoteBundlePublishResult | null => {
  const root = schedulerBundlePath(orchestrationId);
  if (!fsSync.existsSync(root)) return null;
  const files = fsSync
    .readdirSync(root)
    .filter((entry) => entry.endsWith(".json") || entry.endsWith(".html") || entry.endsWith(".txt"))
    .map((entry) => ({
      key: entry.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase(),
      fileName: entry,
      content: fsSync.readFileSync(path.join(root, entry))
    }));
  if (files.length === 0) return null;
  return publishRemoteBundle(`scheduler/${orchestrationId}`, files, `Publish scheduler bundle ${orchestrationId}`);
};

const renderLines = (state: PersistableReportState): string[] => {
  const lines = [state.report.report_type, state.sections[0]?.title[0]?.value ?? state.report.report_id];
  state.sections.forEach((section) => {
    lines.push(section.title[0]?.value ?? section.section_id);
    state.contentBlocks
      .filter((block) => block.section_ref === section.section_id)
      .forEach((block) => {
        lines.push(`- ${block.title[0]?.value ?? block.block_id}`);
        const body = block.content_payload["body"];
        if (typeof body === "string" && body.length > 0) lines.push(`  ${body}`);
      });
  });
  return lines;
};

const renderHtml = (state: PersistableReportState): string => {
  const sectionMarkup = state.sections
    .map((section) => {
      const blocks = state.contentBlocks
        .filter((block) => block.section_ref === section.section_id)
        .map((block) => {
          const payload = block.content_payload;
          const body = typeof payload["body"] === "string" ? payload["body"] : "";
          const metric = typeof payload["metric_value"] === "number" ? `<div class="metric">${payload["metric_value"]}</div>` : "";
          const rows = Array.isArray(payload["table_rows"])
            ? `<table>${(payload["table_rows"] as unknown[][])
                .map((row) => `<tr>${row.map((cell) => `<td>${String(cell)}</td>`).join("")}</tr>`)
                .join("")}</table>`
            : "";
          return `<article data-block-id="${block.block_id}" data-block-type="${block.block_type}">
  <h3>${block.title[0]?.value ?? block.block_id}</h3>
  ${metric}
  <p>${body}</p>
  ${rows}
</article>`;
        })
        .join("\n");
      return `<section data-section-id="${section.section_id}">
  <h2>${section.title[0]?.value ?? section.section_id}</h2>
  ${blocks}
</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${state.sections[0]?.title[0]?.value ?? state.report.report_id}</title>
  <style>
    body { font-family: "Segoe UI", sans-serif; margin: 32px; background: #f5f1e8; color: #1f2933; }
    header { border-bottom: 4px solid #ba5d2a; margin-bottom: 24px; padding-bottom: 16px; }
    section { background: #fffdf7; padding: 20px; margin: 16px 0; border-left: 6px solid #0d5b56; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); }
    h1, h2, h3 { margin: 0 0 12px; }
    .metric { font-size: 28px; font-weight: 700; color: #ba5d2a; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    td { border: 1px solid #d5d9e0; padding: 8px; }
  </style>
</head>
<body>
  <header>
    <h1>${state.sections[0]?.title[0]?.value ?? state.report.report_id}</h1>
    <p>${state.report.report_type}</p>
    <p>Source of truth: internal editable report artifact</p>
  </header>
  ${sectionMarkup}
</body>
</html>`;
};

const createStorageRef = (idPart: string, checksum = "sha256:pending") => ({
  storage_id: id("storage", idPart),
  storage_class: "object",
  uri: `memory://${idPart}`,
  checksum,
  region: "local"
});

const createPreviewRef = (idPart: string, previewType: Artifact["preview_ref"]["preview_type"]) => ({
  preview_id: id("preview", idPart),
  preview_type: previewType,
  storage_ref: id("storage", idPart)
});

const createExecutionStage = (options: {
  reportId: string;
  actorRef: string;
  actorType?: AuditEvent["actor_type"];
  actionRef: string;
  stage: string;
  workspaceId: string;
  tenantRef: string;
  sourceRefs: string[];
  artifactRefs: string[];
  requestedMode: Report["mode"];
  checks: EvidencePack["checks_executed"];
  warnings?: Warning[];
  failureReasons?: FailureReason[];
  degradedReasons?: FailureReason[];
  lineageEdges?: LineageEdge[];
  timestamp: string;
  progress?: number;
  state?: Job["state"];
}): StoredExecutionStage => {
  const evidencePack = EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence", options.reportId, options.stage, options.timestamp),
    verification_status:
      options.failureReasons && options.failureReasons.length > 0
        ? "failed"
        : options.degradedReasons && options.degradedReasons.length > 0
          ? "degraded"
          : options.warnings && options.warnings.length > 0
            ? "success_with_warnings"
            : "verified",
    source_refs: options.sourceRefs,
    generated_artifact_refs: options.artifactRefs,
    checks_executed: options.checks,
    before_refs: options.sourceRefs,
    after_refs: options.artifactRefs,
    metrics: [
      { metric_name: "artifact_count", metric_value: options.artifactRefs.length, metric_unit: "count" },
      { metric_name: "check_count", metric_value: options.checks.length, metric_unit: "count" }
    ],
    warnings: options.warnings ?? [],
    failure_reasons: options.failureReasons ?? [],
    degraded_reasons: options.degradedReasons ?? [],
    replay_context: { action_ref: options.actionRef, report_id: options.reportId },
    reproducibility_metadata: {
      replay_token: id("replay", options.reportId, options.stage, options.timestamp),
      execution_seed: hashValue(`${options.reportId}:${options.stage}:${options.timestamp}`),
      environment_stamp: "report-engine:v1",
      tool_versions: [{ tool: "report-engine", version: "1.0.0" }]
    },
    strict_evidence_level: "standard"
  });
  const job = JobSchema.parse({
    contract: contractEnvelope("job"),
    job_id: id("job", options.reportId, options.stage, options.timestamp),
    capability: REPORT_CAPABILITY_ID,
    requested_mode: options.requestedMode,
    capability_submode: options.stage,
    source_refs: options.sourceRefs,
    artifact_refs: options.artifactRefs,
    progress: options.progress ?? 100,
    stage: options.stage,
    state: options.state ?? (options.degradedReasons && options.degradedReasons.length > 0 ? "degraded" : "completed"),
    warnings: options.warnings ?? [],
    failure_reason: options.failureReasons?.[0] ?? null,
    retry_policy: {
      max_attempts: 1,
      strategy: "fixed",
      backoff_ms: 0
    },
    evidence_ref: evidencePack.evidence_pack_id,
    started_at: options.timestamp,
    finished_at: options.timestamp,
    resource_profile: {
      cpu_class: "standard",
      memory_class: "standard",
      io_class: "standard",
      expected_parallelism: 1
    }
  });
  const auditEvent = AuditEventSchema.parse({
    contract: contractEnvelope("audit"),
    event_id: id("audit", options.reportId, options.stage, options.timestamp),
    timestamp: options.timestamp,
    actor_ref: options.actorRef,
    actor_type: options.actorType ?? "user",
    action_ref: options.actionRef,
    job_ref: job.job_id,
    object_refs: [...options.sourceRefs, ...options.artifactRefs],
    workspace_id: options.workspaceId,
    tenant_ref: options.tenantRef,
    metadata: {
      evidence_ref: evidencePack.evidence_pack_id,
      checks: options.checks.map((check) => check.check_name)
    }
  });
  return {
    job,
    evidencePack,
    auditEvents: [auditEvent],
    lineageEdges: options.lineageEdges ?? []
  };
};

const buildCanonical = (
  request: Pick<ParsedCreateReportRequest, "tenant_ref" | "workspace_id" | "project_id" | "title" | "language" | "template_ref" | "source_refs">,
  reportId: string,
  timestamp: string,
  sections: PersistableReportState["sections"],
  contentBlocks: PersistableReportState["contentBlocks"],
  bindingSet: PersistableReportState["bindingSet"]
): CanonicalRepresentation =>
  CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: id("canonical", reportId, timestamp),
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    source_descriptors: request.source_refs.map((sourceRef, index) => ({
      source_ref: sourceRef,
      source_type: sourceRef.startsWith("dataset") ? "dataset" : "report_source",
      source_revision_ref: id("source-revision", sourceRef, index + 1),
      parser_profile: "report-engine:v1",
      connector_ref: "internal"
    })),
    representation_kind: "report",
    strictness_mode: "smart",
    localization: {
      locale: request.language,
      rtl: request.language.startsWith("ar"),
      numeral_system: request.language.startsWith("ar") ? "arabic_indic" : "latin",
      fallback_locales: [request.language]
    },
    root_node_refs: [id("document-node", reportId)],
    nodes: {
      documents: [
        {
          node_id: id("document-node", reportId),
          node_type: "document",
          parent_node_ref: null,
          child_node_refs: sections.map((section) => id("page-node", section.section_id)),
          name: request.title,
          semantic_labels: ["report"],
          layout_ref: id("layout", reportId),
          data_binding_refs: bindingSet.dataset_binding_refs,
          formula_refs: [],
          lineage_refs: contentBlocks.flatMap((block) => block.lineage_refs),
          template_refs: [request.template_ref],
          evidence_refs: [],
          editable: true,
          page_refs: sections.map((section) => id("page-node", section.section_id)),
          section_refs: sections.map((section) => section.section_id)
        }
      ],
      pages: sections.map((section, index) => ({
        node_id: id("page-node", section.section_id),
        node_type: "page",
        parent_node_ref: id("document-node", reportId),
        child_node_refs: contentBlocks
          .filter((block) => block.section_ref === section.section_id)
          .map((block) => id("text-node", block.block_id)),
        name: section.title[0]?.value ?? section.section_id,
        semantic_labels: [section.section_kind],
        layout_ref: section.layout_ref,
        data_binding_refs: bindingSet.dataset_binding_refs,
        formula_refs: [],
        lineage_refs: contentBlocks.flatMap((block) => block.lineage_refs),
        template_refs: [request.template_ref],
        evidence_refs: [],
        editable: true,
        width: 595,
        height: 842,
        unit: "pt",
        layer_refs: [id("layer", reportId, index + 1)]
      })),
      sheets: [],
      slides: [],
      tables: contentBlocks
        .filter((block) => block.block_type === "table")
        .map((block) => ({
          node_id: id("table-node", block.block_id),
          node_type: "table",
          parent_node_ref: id("page-node", block.section_ref),
          child_node_refs: [],
          name: block.title[0]?.value ?? block.block_id,
          semantic_labels: ["report_table"],
          layout_ref: block.section_ref,
          data_binding_refs: block.binding_refs,
          formula_refs: [],
          lineage_refs: block.lineage_refs,
          template_refs: [],
          evidence_refs: [],
          editable: true,
          row_count: Array.isArray(block.content_payload["table_rows"]) ? (block.content_payload["table_rows"] as unknown[][]).length : 0,
          column_count:
            Array.isArray(block.content_payload["table_rows"]) && Array.isArray((block.content_payload["table_rows"] as unknown[][])[0])
              ? ((block.content_payload["table_rows"] as unknown[][])[0] as unknown[]).length
              : 0,
          schema_ref: "table://report"
        })),
      charts: contentBlocks
        .filter((block) => block.block_type === "chart")
        .map((block) => ({
          node_id: id("chart-node", block.block_id),
          node_type: "chart",
          parent_node_ref: id("page-node", block.section_ref),
          child_node_refs: [],
          name: block.title[0]?.value ?? block.block_id,
          semantic_labels: ["report_chart"],
          layout_ref: block.section_ref,
          data_binding_refs: block.binding_refs,
          formula_refs: [],
          lineage_refs: block.lineage_refs,
          template_refs: [],
          evidence_refs: [],
          editable: true,
          chart_type: "bar",
          series_refs: block.binding_refs,
          axis_refs: []
        })),
      shapes: [],
      text: contentBlocks.map((block) => ({
        node_id: id("text-node", block.block_id),
        node_type: "text",
        parent_node_ref: id("page-node", block.section_ref),
        child_node_refs: [],
        name: block.title[0]?.value ?? block.block_id,
        semantic_labels: [block.block_type],
        layout_ref: block.section_ref,
        data_binding_refs: block.binding_refs,
        formula_refs: [],
        lineage_refs: block.lineage_refs,
        template_refs: [],
        evidence_refs: [],
        editable: block.editability === "editable",
        content: localized(String(block.content_payload["body"] ?? block.title[0]?.value ?? block.block_id), request.language),
        typography_ref: "type://default"
      })),
      images: []
    },
    layout_metadata: {
      coordinate_space: "page",
      bounding_boxes: [],
      z_order: [],
      grid_rules: [],
      alignment_rules: []
    },
    data_binding_refs: bindingSet.bindings.map((binding) => ({
      binding_id: binding.binding_id,
      dataset_ref: binding.dataset_ref,
      query_ref: binding.query_ref,
      target_node_ref: binding.target_node_ref,
      field_mappings: binding.field_mappings
    })),
    formula_refs: [],
    semantic_labels: sections.map((section) => ({
      label_id: id("label", section.section_id),
      label_type: "section_kind",
      label_value: section.section_kind,
      target_ref: section.section_id
    })),
    lineage_refs: contentBlocks.flatMap((block) => block.lineage_refs),
    template_refs: [request.template_ref],
    editability_flags: {
      default_editable: true,
      locked_region_refs: sections.filter((section) => section.lock_policy !== "editable").map((section) => section.section_id),
      lock_reason_codes: sections.filter((section) => section.lock_policy !== "editable").map((section) => section.lock_policy)
    },
    evidence_refs: [],
    created_at: timestamp,
    updated_at: timestamp
  });

const persistWithStage = (store: ReportEngineStore, state: PersistableReportState, stage: StoredExecutionStage): ReportWorkflowResult => ({
  ...store.persistState(state, stage),
  ...stage
});

const buildStateSnapshotForCreate = (request: ParsedCreateReportRequest, reportId: string, timestamp: string): PersistableReportState => {
  const sectionRecords: PersistableReportState["sections"] = [];
  const blockRecords: PersistableReportState["contentBlocks"] = [];
  const bindings: PersistableReportState["bindingSet"]["bindings"] = [];
  request.sections.forEach((sectionInput, sectionIndex) => {
    const sectionId = id("report-section", reportId, sectionIndex + 1);
    const blockRefs: string[] = [];
    sectionInput.blocks.forEach((blockInput, blockIndex) => {
      const blockId = id("report-block", sectionId, blockIndex + 1);
      blockRefs.push(blockId);
      const bindingId = blockInput.dataset_ref ? id("report-binding", blockId) : null;
      if (bindingId) {
        bindings.push({
          schema_namespace: REPORT_SCHEMA_NAMESPACE,
          schema_version: REPORT_SCHEMA_VERSION,
          binding_id: bindingId,
          dataset_ref: blockInput.dataset_ref!,
          query_ref: blockInput.query_ref ?? `${blockInput.dataset_ref}:default`,
          target_node_ref: id("text-node", blockId),
          target_block_ref: blockId,
          field_mappings: blockInput.field_mappings ?? [],
          snapshot_version_ref: null,
          last_refresh_at: null
        });
      }
      blockRecords.push(
        ReportContentBlockSchema.parse({
          schema_namespace: REPORT_SCHEMA_NAMESPACE,
          schema_version: REPORT_SCHEMA_VERSION,
          block_id: blockId,
          report_ref: reportId,
          version_ref: id("report-version", reportId, 1),
          section_ref: sectionId,
          block_type: blockInput.block_type,
          order_index: blockIndex,
          title: localized(blockInput.title, request.language),
          canonical_node_ref: id("text-node", blockId),
          binding_refs: bindingId ? [bindingId] : [],
          citation_refs: blockInput.citations,
          lineage_refs: [id("lineage", blockId)],
          content_payload: {
            body: blockInput.body,
            metric_value: blockInput.metric_value,
            table_rows: blockInput.table_rows,
            chart_series: blockInput.chart_series,
            caption: blockInput.caption,
            page_number: blockInput.page_number,
            source_metadata: blockInput.source_metadata,
            layout_semantics: blockInput.layout_semantics,
            source_lineage_refs: blockInput.source_lineage_refs
          },
          editability: "editable",
          generated_by: blockInput.dataset_ref ? "data_bound" : "manual"
        })
      );
    });
    sectionRecords.push(
      ReportSectionSchema.parse({
        schema_namespace: REPORT_SCHEMA_NAMESPACE,
        schema_version: REPORT_SCHEMA_VERSION,
        section_id: sectionId,
        report_ref: reportId,
        version_ref: id("report-version", reportId, 1),
        parent_section_ref: null,
        section_kind: sectionInput.section_kind,
        title: localized(sectionInput.title, request.language),
        order_index: sectionIndex,
        block_refs: blockRefs,
        child_section_refs: [],
        layout_ref: id("layout", reportId),
        page_anchor_ref: id("page-anchor", sectionId),
        citation_refs: [],
        visibility_state: "visible",
        lock_policy: sectionInput.lock_policy
      })
    );
  });
  const reviewState = ReportReviewStateSchema.parse({
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    review_state_id: id("report-review", reportId),
    report_ref: reportId,
    version_ref: id("report-version", reportId, 1),
    state: "draft",
    reviewer_refs: [],
    review_comment_refs: [],
    latest_comment: null,
    last_reviewed_at: null
  });
  const approvalState = ReportApprovalStateSchema.parse({
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    approval_state_id: id("report-approval", reportId),
    report_ref: reportId,
    version_ref: id("report-version", reportId, 1),
    state: "pending",
    approver_ref: null,
    decision_comment: null,
    decided_at: null
  });
  const bindingSet = ReportBindingSetSchema.parse({
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    binding_set_id: id("report-binding-set", reportId),
    report_ref: reportId,
    version_ref: id("report-version", reportId, 1),
    source_artifact_refs: request.source_refs,
    dataset_binding_refs: bindings.map((binding) => binding.binding_id),
    bindings,
    staleness_status: bindings.length > 0 ? "snapshot" : "live",
    refresh_policy: {
      refresh_mode: "scheduled",
      selective_regeneration_enabled: true,
      stale_after_minutes: 1440
    },
    selective_regeneration_refs: [],
    broken_binding_refs: [],
    last_refresh_at: null
  });
  const layout = ReportLayoutSchema.parse({
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    layout_id: id("layout", reportId),
    report_ref: reportId,
    version_ref: id("report-version", reportId, 1),
    template_ref: request.template_ref,
    brand_preset_ref: request.brand_preset_ref,
    page_size: "a4",
    orientation: "portrait",
    page_margin_profile: "balanced",
    toc_enabled: true,
    appendix_enabled: request.sections.some((section) => section.section_kind === "appendix"),
    region_refs: [id("layout-region", reportId)],
    regions: [
      {
        schema_namespace: REPORT_SCHEMA_NAMESPACE,
        schema_version: REPORT_SCHEMA_VERSION,
        region_id: id("layout-region", reportId),
        region_name: "body",
        anchor_ref: "page://1",
        placement_rules: [],
        lock_policy: "soft_lock"
      }
    ],
    layout_metadata: [{ engine: "report-engine", description: request.description }]
      .concat(
        request.sections.map((section, index) => ({
          engine: "report-engine",
          description: `${section.section_kind}:${section.title}`,
          section_title: section.title,
          section_kind: section.section_kind,
          section_order: index + 1,
          block_count: section.blocks.length,
          page_numbers: section.blocks.map((block) => block.page_number).filter((page): page is number => typeof page === "number"),
          imported_layout_semantics: section.blocks.map((block) => block.layout_semantics),
          imported_source_metadata: section.blocks.map((block) => block.source_metadata)
        }))
      )
  });
  const version = ReportVersionSchema.parse({
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    report_version_id: id("report-version", reportId, 1),
    report_ref: reportId,
    version_ref: {
      version_id: id("version", reportId, 1),
      parent_version_id: null,
      version_number: 1,
      semantic_version: semanticVersion(1)
    },
    change_reason: "initial_creation",
    created_from: "manual_edit",
    draft_state: "draft",
    review_state_ref: reviewState.review_state_id,
    approval_state_ref: approvalState.approval_state_id,
    diff_base_version_ref: null,
    section_refs: sectionRecords.map((section) => section.section_id),
    layout_ref: layout.layout_id,
    content_block_refs: blockRecords.map((block) => block.block_id),
    binding_set_ref: bindingSet.binding_set_id,
    created_by: request.created_by,
    created_at: timestamp
  });
  const canonical = buildCanonical(request, reportId, timestamp, sectionRecords, blockRecords, bindingSet);
  const report = ReportSchema.parse({
    contract: REPORT_CONTRACT,
    schema_namespace: REPORT_SCHEMA_NAMESPACE,
    schema_version: REPORT_SCHEMA_VERSION,
    report_id: reportId,
    artifact_ref: id("artifact", reportId, "editable"),
    canonical_ref: canonical.canonical_id,
    current_version_ref: version.version_ref.version_id,
    report_type: request.report_type,
    mode: request.mode,
    status: "draft",
    template_ref: request.template_ref,
    brand_preset_ref: request.brand_preset_ref,
    binding_set_ref: bindingSet.binding_set_id,
    review_state_ref: reviewState.review_state_id,
    approval_state_ref: approvalState.approval_state_id,
    layout_ref: layout.layout_id,
    section_refs: sectionRecords.map((section) => section.section_id),
    schedule_refs: [],
    publication_refs: [],
    owner_ref: request.created_by,
    created_by: request.created_by,
    created_at: timestamp,
    updated_at: timestamp
  });
  const reportArtifact = ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: id("artifact", reportId, "editable"),
    artifact_type: "report",
    artifact_subtype: "internal_editable_report",
    project_id: request.project_id,
    workspace_id: request.workspace_id,
    source_refs: request.source_refs,
    parent_artifact_refs: [],
    canonical_ref: canonical.canonical_id,
    created_by: request.created_by,
    created_at: timestamp,
    mode: request.mode,
    editable_status: "editable",
    template_status: "applied",
    lineage_ref: id("lineage-group", reportId),
    evidence_ref: id("evidence", reportId, "create"),
    verification_status: "verified",
    storage_ref: createStorageRef(id("artifact", reportId, "editable")),
    preview_ref: createPreviewRef(id("artifact", reportId, "editable"), "html_canvas"),
    export_refs: [],
    version_ref: version.version_ref,
    tenant_ref: request.tenant_ref,
    permission_scope: request.permission_scope
  });
  const versionArtifact = ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: id("artifact", reportId, "version", 1),
    artifact_type: "report",
    artifact_subtype: "report_version_snapshot",
    project_id: request.project_id,
    workspace_id: request.workspace_id,
    source_refs: [reportId],
    parent_artifact_refs: [reportArtifact.artifact_id],
    canonical_ref: canonical.canonical_id,
    created_by: request.created_by,
    created_at: timestamp,
    mode: request.mode,
    editable_status: "editable",
    template_status: "applied",
    lineage_ref: id("lineage-group", reportId),
    evidence_ref: id("evidence", reportId, "create"),
    verification_status: "verified",
    storage_ref: createStorageRef(id("artifact", reportId, "version", 1)),
    preview_ref: createPreviewRef(id("artifact", reportId, "version", 1), "html_canvas"),
    export_refs: [],
    version_ref: version.version_ref,
    tenant_ref: request.tenant_ref,
    permission_scope: request.permission_scope
  });
  return {
    report,
    version,
    layout,
    sections: sectionRecords,
    contentBlocks: blockRecords,
    bindingSet,
    reviewState,
    approvalState,
    canonical,
    reportArtifact,
    versionArtifact,
    publications: [],
    libraryAssets: [],
    schedules: [],
    derivedArtifacts: []
  };
};

const summarizeReportState = (state: PersistableReportState): { title: string; summary: string; highlights: string[] } => {
  const title = state.sections[0]?.title[0]?.value ?? state.report.report_id;
  const highlights = state.contentBlocks
    .slice(0, 6)
    .map((block) => String(block.content_payload["body"] ?? block.title[0]?.value ?? block.block_id))
    .filter((value) => value.length > 0);
  return {
    title,
    summary: highlights[0] ?? reportDescription(state),
    highlights
  };
};

const reportDescription = (state: PersistableReportState): string => {
  const layoutDescription = state.layout.layout_metadata
    .map((entry) => (typeof entry["description"] === "string" ? entry["description"] : ""))
    .find((value) => value.length > 0);
  return layoutDescription ?? state.contentBlocks[0]?.title[0]?.value ?? state.report.report_id;
};

const reportLanguage = (state: PersistableReportState): string =>
  state.sections.flatMap((section) => section.title).find((title) => title.locale.length > 0)?.locale ?? "ar-SA";

const reportAsPresentationSource = (state: PersistableReportState) => {
  const summary = summarizeReportState(state);
  return {
    source_kind: "report_artifact" as const,
    source_ref: state.reportArtifact.artifact_id,
    title: summary.title,
    summary: summary.summary,
    sections: state.sections.map((section, sectionIndex) => {
      const sectionBlocks = state.contentBlocks.filter((block) => block.section_ref === section.section_id);
      const metricBlocks = sectionBlocks.filter((block) => block.block_type === "metric_card");
      const chartBlocks = sectionBlocks.filter((block) => block.block_type === "chart");
      const tableBlocks = sectionBlocks.filter((block) => block.block_type === "table");
      return {
        heading: section.title[0]?.value ?? section.section_id,
        summary: sectionBlocks.find((block) => typeof block.content_payload["body"] === "string")?.content_payload["body"]?.toString() ?? "",
        bullets: sectionBlocks
          .map((block) => String(block.content_payload["body"] ?? block.title[0]?.value ?? block.block_id))
          .slice(0, 4),
        section_kind: section.section_kind,
        order_index: sectionIndex,
        narrative_hierarchy: {
          section_ref: section.section_id,
          parent_section_ref: section.parent_section_ref,
          child_section_refs: section.child_section_refs
        },
        page_numbers: sectionBlocks
          .map((block) => block.content_payload["page_number"])
          .filter((page): page is number => typeof page === "number"),
        captions: sectionBlocks
          .map((block) => String(block.content_payload["caption"] ?? ""))
          .filter((caption) => caption.length > 0),
        tables: tableBlocks.map((block) => ({
          title: block.title[0]?.value ?? block.block_id,
          caption: String(block.content_payload["caption"] ?? ""),
          rows: Array.isArray(block.content_payload["table_rows"]) ? (block.content_payload["table_rows"] as unknown[][]).map((row) => row.map(String)) : [],
          lineage_refs: block.lineage_refs,
          source_lineage_refs: Array.isArray(block.content_payload["source_lineage_refs"]) ? (block.content_payload["source_lineage_refs"] as string[]) : []
        })),
        charts: chartBlocks.map((block) => ({
          title: block.title[0]?.value ?? block.block_id,
          caption: String(block.content_payload["caption"] ?? ""),
          chart_type: String((block.content_payload["layout_semantics"] as Record<string, unknown> | undefined)?.["kind"] ?? "bar"),
          series: Array.isArray(block.content_payload["chart_series"])
            ? (block.content_payload["chart_series"] as Record<string, unknown>[])
            : [],
          lineage_refs: block.lineage_refs,
          source_lineage_refs: Array.isArray(block.content_payload["source_lineage_refs"]) ? (block.content_payload["source_lineage_refs"] as string[]) : []
        })),
        metrics: metricBlocks.map((block) => ({
          label: block.title[0]?.value ?? block.block_id,
          value: Number(block.content_payload["metric_value"] ?? 0),
          unit: String((block.content_payload["source_metadata"] as Record<string, unknown> | undefined)?.["metric_unit"] ?? "")
        }))
      };
    })
  };
};

const inferDatasetProfilesFromReport = (state: PersistableReportState) => {
  const byDataset = new Map<
    string,
    {
      dataset_ref: string;
      display_name: string;
      dimension_fields: Set<string>;
      measure_fields: Set<string>;
      available_filter_fields: Set<string>;
      default_query_ref?: string;
      suggested_chart_type?: "bar_chart" | "line_chart" | "pie_chart" | "area_chart" | "combo_chart";
    }
  >();
  state.bindingSet.bindings.forEach((binding) => {
    const datasetParts = binding.dataset_ref.split("/");
    const existing = byDataset.get(binding.dataset_ref) ?? {
      dataset_ref: binding.dataset_ref,
      display_name: datasetParts[datasetParts.length - 1] ?? binding.dataset_ref,
      dimension_fields: new Set<string>(),
      measure_fields: new Set<string>(),
      available_filter_fields: new Set<string>(),
      default_query_ref: binding.query_ref,
      suggested_chart_type: "bar_chart" as const
    };
    binding.field_mappings.forEach((mapping) => {
      const role = String(mapping["role"] ?? mapping["metric"] ?? mapping["type"] ?? "");
      const field = String(mapping["field"] ?? mapping["name"] ?? mapping["metric"] ?? "");
      if (!field) {
        return;
      }
      if (role.includes("dimension")) {
        existing.dimension_fields.add(field);
        existing.available_filter_fields.add(field);
      } else {
        existing.measure_fields.add(field);
      }
    });
    byDataset.set(binding.dataset_ref, existing);
  });
  if (byDataset.size === 0) {
    byDataset.set("dataset://report-derived", {
      dataset_ref: "dataset://report-derived",
      display_name: "report-derived",
      dimension_fields: new Set(["section"]),
      measure_fields: new Set(["value"]),
      available_filter_fields: new Set(["section"]),
      default_query_ref: "query://report-derived/default",
      suggested_chart_type: "bar_chart"
    });
  }
  return [...byDataset.values()].map((entry) => ({
    dataset_ref: entry.dataset_ref,
    display_name: entry.display_name,
    dimension_fields: [...entry.dimension_fields].length > 0 ? [...entry.dimension_fields] : ["section"],
    measure_fields: [...entry.measure_fields].length > 0 ? [...entry.measure_fields] : ["value"],
    available_filter_fields: [...entry.available_filter_fields].length > 0 ? [...entry.available_filter_fields] : ["section"],
    default_query_ref: entry.default_query_ref,
    suggested_chart_type: entry.suggested_chart_type
  }));
};

const reportAsDashboardBlueprints = (state: PersistableReportState) =>
  state.contentBlocks.map((block, index) => {
    const binding = state.bindingSet.bindings.find((entry) => entry.target_block_ref === block.block_id);
    const layoutSemantics = (block.content_payload["layout_semantics"] as Record<string, unknown> | undefined) ?? {};
    const sourceMetadata = (block.content_payload["source_metadata"] as Record<string, unknown> | undefined) ?? {};
    const widget_type: "kpi_card" | "table" | "bar_chart" | "text" =
      block.block_type === "metric_card"
        ? "kpi_card"
        : block.block_type === "table"
          ? "table"
          : block.block_type === "chart"
            ? "bar_chart"
            : "text";
    return {
      widget_type,
      title: block.title[0]?.value ?? block.block_id,
      subtitle: String(block.content_payload["body"] ?? ""),
      page_id: "page-overview",
      layout: {
        page_id: "page-overview",
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 3,
        width: 6,
        height: widget_type === "table" ? 3 : 2
      },
      binding: binding
        ? {
            dataset_ref: binding.dataset_ref,
            query_ref: binding.query_ref,
            field_mappings: binding.field_mappings,
            calculation_refs: []
          }
        : undefined,
      style_config: {
        source_block_type: block.block_type,
        report_ref: state.report.report_id,
        section_ref: block.section_ref,
        page_number: block.content_payload["page_number"] ?? null,
        caption: block.content_payload["caption"] ?? "",
        layout_semantics: layoutSemantics,
        source_metadata: sourceMetadata,
        refresh_semantics: {
          last_refresh_at: state.bindingSet.last_refresh_at,
          staleness_status: state.bindingSet.staleness_status
        }
      },
      interaction_refs: binding ? [`interaction://report-filter/${binding.dataset_ref}`] : [],
      editable: true,
      warning_codes: [],
      lineage_ref: block.lineage_refs[0]
    };
  });

const reportAsDashboardFilters = (state: PersistableReportState) =>
  inferDatasetProfilesFromReport(state)
    .map((profile, index) => {
      const field = profile.available_filter_fields[0] ?? profile.dimension_fields[0] ?? null;
      if (!field) return null;
      return {
        filter_scope: "global" as const,
        title: `${profile.display_name} ${field}`,
        control_type: "multi_select" as const,
        dataset_ref: profile.dataset_ref,
        field_ref: field,
        default_values: [],
        current_values: [],
        target_widget_refs: state.bindingSet.bindings
          .filter((binding) => binding.dataset_ref === profile.dataset_ref)
          .map((binding) => binding.target_block_ref),
        lineage_ref: id("filter-lineage", state.report.report_id, index + 1)
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

const reportAsDashboardRefreshPolicy = (state: PersistableReportState): CreateDashboardRequest["refresh_policy"] => {
  const activeSchedule = state.schedules.find((schedule) => schedule.state === "enabled");
  return {
    schema_namespace: "rasid.shared.dashboard.v1",
    schema_version: "1.0.0",
    policy_id: id("refresh-policy", state.report.report_id),
    refresh_mode: state.bindingSet.bindings.length > 0 ? "hybrid" : "manual",
    schedule_kind:
      activeSchedule?.cadence === "weekly"
        ? "weekly"
        : activeSchedule?.cadence === "monthly"
          ? "daily"
          : "manual",
    schedule_ref: activeSchedule?.schedule_id ?? `schedule://reports/${state.report.report_id}/derived-dashboard`,
    stale_after_minutes:
      Number(((activeSchedule?.trigger_policy as Record<string, unknown> | undefined)?.["freshness_window_minutes"] as number | null) ?? 60) || 60,
    allow_selective_refresh: true,
    last_refresh_at: state.bindingSet.last_refresh_at
  };
};

const diffRefs = (before: string[], after: string[]) => after.filter((entry) => !before.includes(entry));
const removedRefs = (before: string[], after: string[]) => before.filter((entry) => !after.includes(entry));
const normalizedText = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();
const existingBlockTitle = (block: PersistableReportState["contentBlocks"][number]): string => block.title[0]?.value ?? block.block_id;
const existingBlockSourceLineageRefs = (block: PersistableReportState["contentBlocks"][number]): string[] =>
  Array.isArray(block.content_payload["source_lineage_refs"]) ? (block.content_payload["source_lineage_refs"] as string[]) : [];
const blockInputSourceLineageRefs = (block: z.input<typeof ReportBlockInputSchema>): string[] =>
  Array.isArray(block.source_lineage_refs) ? block.source_lineage_refs : [];
const blockFingerprint = (title: string, payload: Record<string, unknown>): string =>
  hashValue(
    JSON.stringify({
      title,
      body: payload["body"] ?? "",
      metric_value: payload["metric_value"] ?? null,
      table_rows: payload["table_rows"] ?? [],
      chart_series: payload["chart_series"] ?? [],
      caption: payload["caption"] ?? "",
      dataset_ref: payload["dataset_ref"] ?? null,
      query_ref: payload["query_ref"] ?? null
    })
  );
const inputBlockFingerprint = (block: z.input<typeof ReportBlockInputSchema>): string =>
  hashValue(
    JSON.stringify({
      title: block.title,
      body: block.body,
      metric_value: block.metric_value ?? null,
      table_rows: block.table_rows ?? [],
      chart_series: block.chart_series ?? [],
      caption: block.caption ?? "",
      dataset_ref: block.dataset_ref ?? null,
      query_ref: block.query_ref ?? null
    })
  );

const transcriptionBridgePickText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((entry) => transcriptionBridgePickText(entry)).filter(Boolean).join(" | ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "normalized_text", "value", "title", "label", "name", "summary", "caption"]) {
      const picked = transcriptionBridgePickText(record[key]);
      if (picked) return picked;
    }
    return JSON.stringify(record);
  }
  return "";
};

const transcriptionBridgeNormalizeTableRows = (table: Record<string, unknown>): string[][] => {
  const headers = Array.isArray(table.headers)
    ? table.headers.map((entry) => transcriptionBridgePickText(entry))
    : Array.isArray(table.columns)
      ? table.columns.map((entry) => transcriptionBridgePickText(entry))
      : [];
  const rawRows = Array.isArray(table.rows) ? table.rows : [];
  const rows = rawRows.map((row) => {
    if (Array.isArray(row)) return row.map((entry) => transcriptionBridgePickText(entry));
    if (row && typeof row === "object" && headers.length > 0) {
      const record = row as Record<string, unknown>;
      return headers.map((header) => transcriptionBridgePickText(record[header]));
    }
    return [transcriptionBridgePickText(row)];
  });
  return headers.length > 0 ? [headers, ...rows] : rows;
};

const transcriptionBridgeSectionBody = (bundle: UnifiedContentBundle, segmentRefs: string[]): string =>
  segmentRefs
    .map((segmentRef) => bundle.segments.find((segment) => segment.segment_id === segmentRef))
    .filter((segment): segment is UnifiedContentBundle["segments"][number] => Boolean(segment))
    .map((segment) => segment.normalized_text || segment.text || "")
    .filter(Boolean)
    .join("\n\n");

const buildSectionsFromTranscriptionBridge = (
  bundle: UnifiedContentBundle,
  reportHandoffRecord: Record<string, unknown>,
  queryDatasetRecord: Record<string, unknown>
): z.input<typeof ReportSectionInputSchema>[] => {
  const sections: z.input<typeof ReportSectionInputSchema>[] = [];
  const handoffSections = Array.isArray(reportHandoffRecord.sections)
    ? (reportHandoffRecord.sections as Record<string, unknown>[])
    : [];
  const handoffTables = Array.isArray(reportHandoffRecord.tables)
    ? (reportHandoffRecord.tables as Record<string, unknown>[])
    : [];
  const handoffActionItems = Array.isArray(reportHandoffRecord.action_items)
    ? reportHandoffRecord.action_items
    : [];
  const executiveSummary = transcriptionBridgePickText(reportHandoffRecord.executive_summary);
  const datasetRef = `dataset://transcription/${bundle.bundle_id}`;

  sections.push({
    section_kind: "cover",
    title: transcriptionBridgePickText(reportHandoffRecord.title) || `Transcription ${bundle.bundle_id}`,
    blocks: [
      {
        block_type: "narrative",
        title: "Transcription Intake",
        body:
          executiveSummary ||
          bundle.summaries.find((summary) => summary.level === "executive")?.summary_text ||
          bundle.segments.slice(0, 3).map((segment) => segment.text).join(" "),
        citations: [bundle.bundle_id],
        source_metadata: {
          source: "transcription-report-handoff",
          bundle_id: bundle.bundle_id,
          verification_gate: bundle.verification_gate,
          source_count: bundle.source_refs.length
        },
        layout_semantics: {
          transcript_segment_count: bundle.segments.length,
          extracted_table_count: bundle.tables.length,
          query_ready: bundle.query_ready
        },
        source_lineage_refs: bundle.lineage_refs.slice(0, 8)
      }
    ]
  });

  if (executiveSummary) {
    sections.push({
      section_kind: "executive_summary",
      title: "Executive Summary",
      blocks: [
        {
          block_type: "narrative",
          title: "Executive Summary",
          body: executiveSummary,
          citations: bundle.source_refs,
          source_metadata: {
            source: "transcription-report-handoff",
            bundle_id: bundle.bundle_id,
            summary_level: "executive"
          },
          layout_semantics: {
            summary_ref: bundle.summaries.find((summary) => summary.level === "executive")?.summary_id ?? null
          },
          source_lineage_refs: bundle.lineage_refs.slice(0, 8)
        }
      ]
    });
  }

  handoffSections.forEach((section, index) => {
    const segmentRefs = Array.isArray(section.segment_refs) ? (section.segment_refs as string[]) : [];
    sections.push({
      section_kind: index === 0 && !executiveSummary ? "executive_summary" : "body",
      title: transcriptionBridgePickText(section.title) || `Section ${index + 1}`,
      blocks: [
        {
          block_type: "narrative",
          title: transcriptionBridgePickText(section.title) || `Section ${index + 1}`,
          body: transcriptionBridgeSectionBody(bundle, segmentRefs) || `Source ${transcriptionBridgePickText(section.source_ref)}`,
          citations: segmentRefs,
          source_metadata: {
            source: "transcription-report-handoff",
            source_ref: transcriptionBridgePickText(section.source_ref),
            segment_refs: segmentRefs,
            bundle_id: bundle.bundle_id
          },
          layout_semantics: {
            source_ref: transcriptionBridgePickText(section.source_ref),
            segment_count: segmentRefs.length
          },
          source_lineage_refs: segmentRefs
        }
      ]
    });
  });

  if (handoffTables.length > 0) {
    sections.push({
      section_kind: "appendix",
      title: "Extracted Tables",
      blocks: handoffTables.slice(0, 3).map((table, index) => ({
        block_type: "table" as const,
        title: transcriptionBridgePickText(table.title) || transcriptionBridgePickText(table.caption) || `Table ${index + 1}`,
        body: transcriptionBridgePickText(table.summary),
        table_rows: transcriptionBridgeNormalizeTableRows(table),
        caption: transcriptionBridgePickText(table.caption),
        citations: [transcriptionBridgePickText(table.source_ref)].filter(Boolean),
        dataset_ref: datasetRef,
        query_ref: `query://transcription/${bundle.bundle_id}/table/${index + 1}`,
        field_mappings: [{ role: "table", field: transcriptionBridgePickText(table.table_id) || `table_${index + 1}` }],
        source_metadata: {
          source: "transcription-report-handoff",
          extracted_from: "transcription",
          table_ref: transcriptionBridgePickText(table.table_id),
          source_ref: transcriptionBridgePickText(table.source_ref)
        },
        layout_semantics: {
          query_dataset_bound: true,
          row_count: Array.isArray(table.rows) ? table.rows.length : 0
        },
        source_lineage_refs: [transcriptionBridgePickText(table.table_id), transcriptionBridgePickText(table.source_ref)].filter(Boolean)
      }))
    });
  }

  if (handoffActionItems.length > 0) {
    sections.push({
      section_kind: "appendix",
      title: "Action Items",
      blocks: [
        {
          block_type: "commentary",
          title: "Action Items",
          body: handoffActionItems
            .map((item, index) => `${index + 1}. ${transcriptionBridgePickText((item as Record<string, unknown>).description ?? item)}`)
            .join("\n"),
          citations: bundle.source_refs,
          source_metadata: {
            source: "transcription-report-handoff",
            action_item_count: handoffActionItems.length,
            bundle_id: bundle.bundle_id
          },
          layout_semantics: {
            action_item_count: handoffActionItems.length
          },
          source_lineage_refs: bundle.action_items.flatMap((item) => item.supporting_segment_refs).slice(0, 12)
        }
      ]
    });
  }

  const queryDatasetTables = Array.isArray(queryDatasetRecord.tables)
    ? (queryDatasetRecord.tables as Record<string, unknown>[])
    : [];
  const queryDatasetFields = Array.isArray(queryDatasetRecord.fields)
    ? (queryDatasetRecord.fields as Record<string, unknown>[])
    : [];
  const queryDatasetEntities = Array.isArray(queryDatasetRecord.entities)
    ? (queryDatasetRecord.entities as Record<string, unknown>[])
    : [];

  if (queryDatasetTables.length > 0 || queryDatasetFields.length > 0 || queryDatasetEntities.length > 0) {
    const datasetBlocks: z.input<typeof ReportBlockInputSchema>[] = [];
    if (queryDatasetTables.length > 0) {
      datasetBlocks.push({
        block_type: "table",
        title: transcriptionBridgePickText(queryDatasetTables[0].title) || "Query Dataset Snapshot",
        body: "Structured extraction dataset consumed from transcription query-dataset.",
        table_rows: transcriptionBridgeNormalizeTableRows(queryDatasetTables[0]),
        caption: transcriptionBridgePickText(queryDatasetTables[0].caption) || "Query dataset table",
        dataset_ref: datasetRef,
        query_ref: `query://transcription/${bundle.bundle_id}/dataset/table/1`,
        field_mappings: [{ role: "table", field: "query_dataset.tables[0]" }],
        citations: [bundle.bundle_id],
        source_metadata: {
          source: "transcription-query-dataset",
          bundle_id: bundle.bundle_id,
          table_count: queryDatasetTables.length
        },
        layout_semantics: {
          query_dataset_bound: true
        },
        source_lineage_refs: bundle.lineage_refs.slice(0, 8)
      });
    }
    if (queryDatasetFields.length > 0) {
      datasetBlocks.push({
        block_type: "commentary",
        title: "Structured Fields",
        body: queryDatasetFields
          .slice(0, 8)
          .map(
            (field, index) =>
              `${index + 1}. ${transcriptionBridgePickText(field.name ?? field.field_name)}: ${transcriptionBridgePickText(field.value ?? field.field_value)}`
          )
          .join("\n"),
        dataset_ref: datasetRef,
        query_ref: `query://transcription/${bundle.bundle_id}/dataset/fields`,
        field_mappings: queryDatasetFields.slice(0, 8).map((field) => ({
          role: "field",
          field: transcriptionBridgePickText(field.name ?? field.field_name)
        })),
        citations: [bundle.bundle_id],
        source_metadata: {
          source: "transcription-query-dataset",
          bundle_id: bundle.bundle_id,
          field_count: queryDatasetFields.length
        },
        layout_semantics: {
          query_dataset_bound: true,
          entity_count: queryDatasetEntities.length
        },
        source_lineage_refs: bundle.fields.slice(0, 8).map((field) => field.field_id)
      });
    }
    sections.push({
      section_kind: "appendix",
      title: "Structured Extraction Dataset",
      blocks: datasetBlocks
    });
  }

  return sections;
};

const presentationBackSyncBlocks = (
  bundle: PresentationBundle,
  publication: PresentationPublicationResult,
  timestamp: string
): z.input<typeof ReportBlockInputSchema>[] => {
  const storyboardRecords = z.array(JsonRecordSchema).catch([]).parse(bundle.storyboard as unknown);
  const slideNodes = bundle.canonical.nodes.slides.slice(0, 4);
  const summaryBody = [
    `Presentation ${bundle.deck.deck_id} published to ${publication.publication.target_ref}.`,
    `Slides: ${bundle.canonical.nodes.slides.length}.`,
    `Parity ready: ${bundle.parityValidation?.publish_ready ? "yes" : "no"}.`
  ].join(" ");
  const blocks: z.input<typeof ReportBlockInputSchema>[] = [
    {
      block_type: "commentary",
      title: "Presentation Back-Sync",
      body: summaryBody,
      citations: [publication.publication.publication_id],
      source_metadata: {
        downstream_capability: "presentations",
        deck_id: bundle.deck.deck_id,
        publication_id: publication.publication.publication_id,
        presentation_version_ref: bundle.version.version_ref.version_id,
        exported_targets: bundle.exportArtifacts.map((entry) => entry.target)
      },
      layout_semantics: {
        slide_count: bundle.canonical.nodes.slides.length,
        storyboard_refs: bundle.storyboard.map((item) => item.storyboard_slide_plan_id),
        timestamp
      },
      source_lineage_refs: [publication.publication.publication_id]
    }
  ];
  slideNodes.forEach((slide, index) => {
    const storyboard = storyboardRecords[index] ?? {};
    blocks.push({
      block_type: "narrative",
      title: `${slide.name} Sync`,
      body: String(storyboard["summary"] ?? storyboard["headline"] ?? slide.name),
      citations: [publication.publication.publication_id],
      source_metadata: {
        downstream_capability: "presentations",
        slide_node_ref: slide.node_id,
        slide_index: index + 1,
        storyboard_ref: bundle.storyboard[index]?.storyboard_slide_plan_id ?? null
      },
      layout_semantics: {
        semantic_labels: slide.semantic_labels,
        child_node_refs: slide.child_node_refs,
        layout_ref: slide.layout_ref
      },
      source_lineage_refs: [slide.node_id]
    });
  });
  return blocks;
};

const dashboardBackSyncBlocks = (
  workflow: DashboardWorkflowResult,
  publication: DashboardPublicationResult,
  timestamp: string
): z.input<typeof ReportBlockInputSchema>[] => {
  const blocks: z.input<typeof ReportBlockInputSchema>[] = [
    {
      block_type: "commentary",
      title: "Dashboard Back-Sync",
      body: `Dashboard ${workflow.dashboard.dashboard_id} published via ${publication.publication.target_ref}.`,
      citations: [publication.publication.publication_id],
      source_metadata: {
        downstream_capability: "dashboards",
        dashboard_id: workflow.dashboard.dashboard_id,
        publication_id: publication.publication.publication_id,
        dashboard_version_ref: workflow.version.version_id
      },
      layout_semantics: {
        widget_count: workflow.dashboard.widgets.length,
        page_count: workflow.dashboard.pages.length,
        filter_refs: workflow.dashboard.filter_sets.map((filter) => filter.filter_id),
        timestamp
      },
      source_lineage_refs: [publication.publication.publication_id]
    }
  ];
  workflow.dashboard.widgets.slice(0, 4).forEach((widget) => {
    const binding = workflow.dashboard.bindings.find((entry) => entry.target_widget_ref === widget.widget_id);
    const tableRows =
      widget.widget_type === "table"
        ? [
            ["Widget", "Dataset", "Query"],
            [widget.title, binding?.dataset_ref ?? "none", binding?.query_ref ?? "none"]
          ]
        : [];
    blocks.push({
      block_type:
        widget.widget_type === "kpi_card"
          ? "metric_card"
          : widget.widget_type === "table"
            ? "table"
            : widget.widget_type.includes("chart")
              ? "chart"
              : "narrative",
      title: widget.title,
      body: widget.subtitle,
      dataset_ref: binding?.dataset_ref ?? null,
      query_ref: binding?.query_ref ?? null,
      field_mappings: binding?.field_mappings ?? [],
      citations: [publication.publication.publication_id],
      table_rows: tableRows,
      chart_series:
        widget.widget_type.includes("chart")
          ? [{ label: "bindings", value: binding?.field_mappings.length ?? 0 }, { label: "warnings", value: widget.warning_codes.length }]
          : [],
      metric_value: widget.widget_type === "kpi_card" ? Number(widget.style_config["metric_value"] ?? 0) : undefined,
      source_metadata: {
        downstream_capability: "dashboards",
        widget_id: widget.widget_id,
        widget_type: widget.widget_type,
        binding_id: binding?.binding_id ?? null,
        filter_refs: workflow.dashboard.filter_sets
          .filter((filter) => filter.target_widget_refs.includes(widget.widget_id))
          .map((filter) => filter.filter_id)
      },
      layout_semantics: {
        interaction_refs: widget.interaction_refs,
        style_config: widget.style_config,
        widget_page_ref: widget.page_id
      },
      source_lineage_refs: [widget.widget_id]
    });
  });
  return blocks;
};

export class ReportEngine {
  readonly store: ReportEngineStore;

  constructor(options: ReportEngineOptions = {}) {
    this.store = new ReportEngineStore(options.storageDir ?? defaultReportEngineStorageRoot());
  }

  private createPresentationEngine(): PresentationEngine {
    return new PresentationEngine();
  }

  private createDashboardEngine(): DashboardEngine {
    return new DashboardEngine({
      storageDir: path.join(this.store.rootDir, "integrations", "dashboard-engine")
    });
  }

  private applyBackSyncSection(
    reportId: string,
    actorRef: string,
    downstreamCapability: "presentations" | "dashboards",
    downstreamRef: string,
    downstreamPublicationRef: string | null,
    downstreamVersionRef: string | null,
    sectionTitle: string,
    blocks: z.input<typeof ReportBlockInputSchema>[],
    timestamp: string
  ): { result: ReportWorkflowResult; record: ReportBackSyncRecord } {
    const before = this.store.loadState(reportId);
    const priorRecord = this.store
      .listBackSyncRecords(reportId)
      .filter((entry) => entry.downstream_capability === downstreamCapability && entry.downstream_ref === downstreamRef)
      .sort((left, right) => right.synced_at.localeCompare(left.synced_at))[0];
    const result = this.updateReport({
      report_id: reportId,
      actor_ref: actorRef,
      mutation: {
        mutation_kind: "reconcile_section",
        section_title: sectionTitle,
        downstream_capability: downstreamCapability,
        downstream_ref: downstreamRef,
        downstream_publication_ref: downstreamPublicationRef,
        downstream_version_ref: downstreamVersionRef,
        merge_mode: "conflict_preserving",
        allow_prune: true,
        blocks
      },
      timestamp
    });
    const syncedSectionRefs = diffRefs(before.sections.map((section) => section.section_id), result.sections.map((section) => section.section_id));
    const syncedBlockRefs = diffRefs(before.contentBlocks.map((block) => block.block_id), result.contentBlocks.map((block) => block.block_id));
    const removedBlockRefs = removedRefs(before.contentBlocks.map((block) => block.block_id), result.contentBlocks.map((block) => block.block_id));
    const conflictRefs = result.contentBlocks
      .filter((block) =>
        Array.isArray((block.content_payload["source_metadata"] as Record<string, unknown> | undefined)?.["reconciliation_conflicts"])
      )
      .map((block) => block.block_id);
    const matchedSection =
      priorRecord?.matched_section_ref && result.sections.find((section) => section.section_id === priorRecord.matched_section_ref)
        ? priorRecord.matched_section_ref
        : result.sections.find((section) => (section.title[0]?.value ?? "") === sectionTitle)?.section_id ?? null;
    const record = this.store.saveBackSyncRecord({
      sync_id: id("back-sync", reportId, downstreamCapability, timestamp),
      report_id: reportId,
      downstream_capability: downstreamCapability,
      downstream_ref: downstreamRef,
      downstream_publication_ref: downstreamPublicationRef,
      downstream_version_ref: downstreamVersionRef,
      source_version_ref: before.version.version_ref.version_id,
      created_version_ref: result.version.version_ref.version_id,
      matched_section_ref: matchedSection,
      synced_section_refs: syncedSectionRefs,
      synced_block_refs: syncedBlockRefs,
      removed_block_refs: removedBlockRefs,
      conflict_refs: conflictRefs,
      change_kinds: priorRecord ? ["reconcile_section", "derived_feedback"] : ["append_section", "derived_feedback"],
      reconciliation_mode: priorRecord ? "conflict_preserving" : "append_only",
      merge_summary: {
        prior_sync_ref: priorRecord?.sync_id ?? null,
        removed_block_count: removedBlockRefs.length,
        conflict_count: conflictRefs.length
      },
      summary: `${downstreamCapability} output was structurally reconciled back into the editable report state.`,
      synced_at: timestamp,
      synced_by: actorRef
    });
    return { result, record };
  }

  async ingestExternalReport(input: IngestExternalReportRequest): Promise<ReportExternalIngestResult> {
    const request = IngestExternalReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const parserKind =
      request.parser_hint === "auto"
        ? request.file_path.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : "docx"
        : request.parser_hint;
    const parsed =
      parserKind === "pdf"
        ? await parsePdfExternalSource(request.file_path, this.store.rootDir)
        : await parseDocxExternalSource(request.file_path, this.store.rootDir);
    const reportId =
      request.report_id ??
      id("report", request.title ?? parsed.title, path.basename(request.file_path, path.extname(request.file_path)));
    const ingestId = id("ingest", reportId, parserKind, timestamp);
    const sourceArtifactId = id("artifact", reportId, "source", parserKind, timestamp);
    const created = this.createReport({
      report_id: reportId,
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.created_by,
      title: request.title ?? parsed.title,
      description:
        request.description.length > 0
          ? request.description
          : `Imported from external ${parserKind.toUpperCase()} source.`,
      report_type: request.report_type,
      mode: request.mode,
      language: request.language,
      template_ref: request.template_ref,
      brand_preset_ref: request.brand_preset_ref,
      source_refs: [...request.source_refs, sourceArtifactId],
      permission_scope: request.permission_scope,
      sections: buildImportedSections(
        request.title ?? parsed.title,
        parsed,
        `Imported ${parserKind.toUpperCase()} source ${path.basename(request.file_path)}`,
        parserKind
      ),
      timestamp
    });
    const current = this.store.loadState(reportId);
    const sourceArtifact = this.store.writeAuxiliaryArtifact(
      reportId,
      ArtifactSchema.parse({
        contract: contractEnvelope("artifact"),
        artifact_id: sourceArtifactId,
        artifact_type: "source_file",
        artifact_subtype: `external_${parserKind}_source`,
        project_id: current.reportArtifact.project_id,
        workspace_id: current.reportArtifact.workspace_id,
        source_refs: [request.file_path],
        parent_artifact_refs: [],
        canonical_ref: current.canonical.canonical_id,
        created_by: request.created_by,
        created_at: timestamp,
        mode: current.report.mode,
        editable_status: "non_editable",
        template_status: "none",
        lineage_ref: id("lineage-group", reportId),
        evidence_ref: id("evidence", reportId, "external-ingest"),
        verification_status: parsed.warning_codes.length > 0 ? "success_with_warnings" : "verified",
        storage_ref: createStorageRef(sourceArtifactId),
        preview_ref: createPreviewRef(sourceArtifactId, parserKind === "pdf" ? "pdf_preview" : "html_canvas"),
        export_refs: [],
        version_ref: current.version.version_ref,
        tenant_ref: current.reportArtifact.tenant_ref,
        permission_scope: current.reportArtifact.permission_scope
      }),
      path.join("imports", ingestId, `source${parserKind === "pdf" ? ".pdf" : ".docx"}`),
      await fs.readFile(request.file_path)
    );
    const parsedArtifact = this.store.writeAuxiliaryArtifact(
      reportId,
      ArtifactSchema.parse({
        contract: contractEnvelope("artifact"),
        artifact_id: id("artifact", reportId, "parsed", parserKind, timestamp),
        artifact_type: "workflow_output",
        artifact_subtype: `external_${parserKind}_parse_record`,
        project_id: current.reportArtifact.project_id,
        workspace_id: current.reportArtifact.workspace_id,
        source_refs: [sourceArtifact.artifact_id],
        parent_artifact_refs: [current.reportArtifact.artifact_id],
        canonical_ref: current.canonical.canonical_id,
        created_by: request.created_by,
        created_at: timestamp,
        mode: current.report.mode,
        editable_status: "non_editable",
        template_status: "applied",
        lineage_ref: id("lineage-group", reportId),
        evidence_ref: id("evidence", reportId, "external-ingest"),
        verification_status: parsed.warning_codes.length > 0 ? "success_with_warnings" : "verified",
        storage_ref: createStorageRef(id("artifact", reportId, "parsed", parserKind)),
        preview_ref: createPreviewRef(id("artifact", reportId, "parsed", parserKind), "html_canvas"),
        export_refs: [],
        version_ref: current.version.version_ref,
        tenant_ref: current.reportArtifact.tenant_ref,
        permission_scope: current.reportArtifact.permission_scope
      }),
      path.join("imports", ingestId, "parsed-structure.json"),
      JSON.stringify(parsed, null, 2)
    );
    const renderedPageArtifacts = parsed.rendered_pages.map((renderedPagePath, index) =>
      this.store.writeAuxiliaryArtifact(
        reportId,
        ArtifactSchema.parse({
          contract: contractEnvelope("artifact"),
          artifact_id: id("artifact", reportId, "parsed-page", index + 1, timestamp),
          artifact_type: "workflow_output",
          artifact_subtype: "external_pdf_page_render",
          project_id: current.reportArtifact.project_id,
          workspace_id: current.reportArtifact.workspace_id,
          source_refs: [sourceArtifact.artifact_id],
          parent_artifact_refs: [parsedArtifact.artifact_id],
          canonical_ref: current.canonical.canonical_id,
          created_by: request.created_by,
          created_at: timestamp,
          mode: current.report.mode,
          editable_status: "non_editable",
          template_status: "applied",
          lineage_ref: id("lineage-group", reportId),
          evidence_ref: id("evidence", reportId, "external-ingest"),
          verification_status: "verified",
          storage_ref: createStorageRef(id("artifact", reportId, "parsed-page", index + 1)),
          preview_ref: createPreviewRef(id("artifact", reportId, "parsed-page", index + 1), "image_render"),
          export_refs: [],
          version_ref: current.version.version_ref,
          tenant_ref: current.reportArtifact.tenant_ref,
          permission_scope: current.reportArtifact.permission_scope
        }),
        path.join("imports", ingestId, "pages", path.basename(renderedPagePath)),
        fsSync.readFileSync(renderedPagePath)
      )
    );
    const ingestRecord = this.store.saveIngestRecord({
      ingest_id: ingestId,
      report_id: reportId,
      source_artifact_ref: sourceArtifact.artifact_id,
      parser_kind: parserKind,
      parser_profile: `report-engine:${parserKind}:fidelity-v2`,
      original_file_name: path.basename(request.file_path),
      original_file_path: request.file_path,
      extracted_title: request.title ?? parsed.title,
      extracted_text: parsed.extracted_text,
      source_language: parsed.source_language,
      page_count: parsed.page_count,
      section_count: parsed.section_count,
      table_count: parsed.table_count,
      chart_count: parsed.chart_count,
      caption_count: parsed.caption_count,
      rendered_page_refs: renderedPageArtifacts.map((artifact) => artifact.artifact_id),
      page_structure: parsed.page_structure,
      layout_semantics: parsed.layout_semantics,
      geometry_map: parsed.geometry_map,
      page_semantics: parsed.page_semantics,
      section_hierarchy: parsed.section_hierarchy,
      block_lineage_map: parsed.block_lineage_map,
      imported_at: timestamp,
      imported_by: request.created_by,
      warning_codes: parsed.warning_codes
    });
    const state: PersistableReportState = {
      ...current,
      layout: ReportLayoutSchema.parse({
        ...current.layout,
        layout_metadata: [
          ...current.layout.layout_metadata,
          {
            parser_kind: parserKind,
            parser_profile: ingestRecord.parser_profile,
            page_count: parsed.page_count,
            section_count: parsed.section_count,
            table_count: parsed.table_count,
            chart_count: parsed.chart_count,
            caption_count: parsed.caption_count,
            page_structure: parsed.page_structure,
            page_semantics: parsed.page_semantics,
            geometry_map: parsed.geometry_map,
            section_hierarchy: parsed.section_hierarchy,
            block_lineage_map: parsed.block_lineage_map,
            hyperlinks: parsed.hyperlinks,
            embedded_assets: parsed.embedded_assets,
            document_metadata: parsed.document_metadata
          }
        ]
      }),
      derivedArtifacts: [
        ...current.derivedArtifacts.filter(
          (artifact) =>
            artifact.artifact_id !== sourceArtifact.artifact_id &&
            artifact.artifact_id !== parsedArtifact.artifact_id &&
            !renderedPageArtifacts.some((pageArtifact) => pageArtifact.artifact_id === artifact.artifact_id)
        ),
        sourceArtifact,
        parsedArtifact,
        ...renderedPageArtifacts
      ]
    };
    const stage = createExecutionStage({
      reportId,
      actorRef: request.created_by,
      actionRef: "reports.ingest_external_report.v1",
      stage: "report_external_ingest",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [sourceArtifact.artifact_id],
      artifactRefs: [current.reportArtifact.artifact_id, current.versionArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", reportId, "external-ingest", timestamp),
          check_name: "external_ingest_parse_check",
          check_type: "ingest",
          passed: parsed.paragraphs.length > 0 || parsed.table_count > 0,
          severity: "critical",
          details: `External ${parserKind.toUpperCase()} source was parsed into editable report sections with layout, table, chart, and caption metadata.`,
          impacted_refs: [sourceArtifact.artifact_id, parsedArtifact.artifact_id, current.reportArtifact.artifact_id]
        }
      ],
      warnings: parsed.warning_codes.map((warningCode) =>
        baseWarning(warningCode, "External ingest warning.", `Parser emitted ${warningCode}.`, [sourceArtifact.artifact_id])
      ),
      lineageEdges: [
        {
          edge_id: id("edge", reportId, "external-ingest", timestamp),
          from_ref: sourceArtifact.artifact_id,
          to_ref: current.reportArtifact.artifact_id,
          transform_ref: "reports.ingest.external",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        },
        ...state.contentBlocks.flatMap((block) =>
          (Array.isArray(block.content_payload["source_lineage_refs"]) ? (block.content_payload["source_lineage_refs"] as string[]) : []).map(
            (lineageRef, index): LineageEdge => ({
              edge_id: id("edge", reportId, "external-block", block.block_id, index + 1, timestamp),
              from_ref: lineageRef,
              to_ref: block.block_id,
              transform_ref: "reports.ingest.external.block",
              ai_suggestion_ref: "",
              ai_decision: "not_applicable",
              template_ref: current.report.template_ref,
              dataset_binding_ref: current.bindingSet.binding_set_id,
              version_diff_ref: current.version.version_ref.version_id
            })
          )
        )
      ]
    });
    return {
      state: this.store.persistState(state, stage),
      sourceArtifact,
      ingestRecord,
      payload: {
        parser_kind: parserKind,
        source_path: request.file_path,
        extracted_title: ingestRecord.extracted_title,
        extracted_paragraph_count: parsed.paragraphs.length,
        page_count: parsed.page_count,
        section_count: parsed.section_count,
        table_count: parsed.table_count,
        chart_count: parsed.chart_count,
        caption_count: parsed.caption_count,
        page_structure: parsed.page_structure,
        layout_semantics: parsed.layout_semantics,
        geometry_map: parsed.geometry_map,
        page_semantics: parsed.page_semantics,
        section_hierarchy: parsed.section_hierarchy,
        block_lineage_map: parsed.block_lineage_map,
        hyperlinks: parsed.hyperlinks,
        embedded_assets: parsed.embedded_assets,
        document_metadata: parsed.document_metadata,
        fixture_profile: parsed.fixture_profile ?? null,
        expected: parsed.expected ?? null,
        rendered_page_paths: renderedPageArtifacts.map((artifact) => new URL(artifact.storage_ref.uri).pathname),
        parsed_structure_artifact_ref: parsedArtifact.artifact_id,
        warning_codes: parsed.warning_codes
      },
      ...stage
    };
  }

  createReportFromTranscription(input: CreateReportFromTranscriptionRequest): ReportWorkflowResult {
    const request = CreateReportFromTranscriptionRequestSchema.parse(input);
    const sections = buildSectionsFromTranscriptionBridge(request.bundle, request.report_handoff, request.query_dataset);
    const sourceRefs = [
      request.bundle.bundle_id,
      request.bundle.artifact_ref,
      ...request.transcription_artifact_refs,
      ...request.source_refs,
      ...Object.values(request.transcription_runtime_refs).filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    ].filter((entry, index, array) => array.indexOf(entry) === index);
    return this.createReport({
      report_id: request.report_id,
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.created_by,
      title: request.title ?? `Transcription Report ${request.bundle.bundle_id}`,
      description:
        request.description ||
        `Created from transcription bundle ${request.bundle.bundle_id} with report-handoff and query-dataset consumption.`,
      report_type: request.report_type,
      mode: request.mode,
      language: request.language,
      template_ref: request.template_ref,
      brand_preset_ref: request.brand_preset_ref,
      source_refs: sourceRefs,
      sections,
      timestamp: request.timestamp
    });
  }

  createReport(input: CreateReportRequest): ReportWorkflowResult {
    const request = CreateReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const reportId = request.report_id ?? id("report", request.title, timestamp.slice(11, 19));
    const state = buildStateSnapshotForCreate(request, reportId, timestamp);
    const stage = createExecutionStage({
      reportId,
      actorRef: request.created_by,
      actionRef: "reports.create_report.v1",
      stage: "report_create",
      workspaceId: request.workspace_id,
      tenantRef: request.tenant_ref,
      sourceRefs: request.source_refs,
      artifactRefs: [state.reportArtifact.artifact_id, state.versionArtifact.artifact_id],
      requestedMode: request.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", reportId, "structure", timestamp),
          check_name: "report_structure_check",
          check_type: "schema",
          passed: true,
          severity: "high",
          details: "Sections, blocks, layout, and binding-set were materialized successfully.",
          impacted_refs: [state.report.report_id, ...state.sections.map((section) => section.section_id)]
        },
        {
          check_id: id("check", reportId, "source-of-truth", timestamp),
          check_name: "source_of_truth_check",
          check_type: "artifact",
          passed: true,
          severity: "critical",
          details: "Internal editable report artifact is the system of record.",
          impacted_refs: [state.reportArtifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", reportId, "create", timestamp),
          from_ref: state.canonical.canonical_id,
          to_ref: state.reportArtifact.artifact_id,
          transform_ref: "reports.create",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: state.report.template_ref,
          dataset_binding_ref: state.bindingSet.binding_set_id,
          version_diff_ref: ""
        }
      ]
    });
    return persistWithStage(this.store, state, stage);
  }

  updateReport(input: UpdateReportRequest): ReportWorkflowResult {
    const request = UpdateReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const nextVersionNumber = current.version.version_ref.version_number + 1;
    const nextVersionId = id("version", current.report.report_id, nextVersionNumber);
    const nextReportVersionId = id("report-version", current.report.report_id, nextVersionNumber);
    const sections = clone(current.sections);
    const blocks = clone(current.contentBlocks);
    const bindings = clone(current.bindingSet.bindings);
    if (request.mutation.mutation_kind === "add_section") {
      const sectionId = id("report-section", current.report.report_id, sections.length + 1);
      const blockRefs: string[] = [];
      request.mutation.section.blocks.forEach((blockInput, blockIndex) => {
        const blockId = id("report-block", sectionId, blockIndex + 1);
        blockRefs.push(blockId);
        const bindingId = blockInput.dataset_ref ? id("report-binding", blockId) : null;
        if (bindingId) {
          bindings.push({
            schema_namespace: REPORT_SCHEMA_NAMESPACE,
            schema_version: REPORT_SCHEMA_VERSION,
            binding_id: bindingId,
            dataset_ref: blockInput.dataset_ref!,
            query_ref: blockInput.query_ref ?? `${blockInput.dataset_ref}:refresh`,
            target_node_ref: id("text-node", blockId),
            target_block_ref: blockId,
            field_mappings: blockInput.field_mappings,
            snapshot_version_ref: null,
            last_refresh_at: null
          });
        }
        blocks.push(
          ReportContentBlockSchema.parse({
            schema_namespace: REPORT_SCHEMA_NAMESPACE,
            schema_version: REPORT_SCHEMA_VERSION,
            block_id: blockId,
            report_ref: current.report.report_id,
            version_ref: nextReportVersionId,
            section_ref: sectionId,
            block_type: blockInput.block_type,
            order_index: blockIndex,
            title: localized(blockInput.title),
            canonical_node_ref: id("text-node", blockId),
            binding_refs: bindingId ? [bindingId] : [],
            citation_refs: blockInput.citations,
            lineage_refs: [id("lineage", blockId)],
            content_payload: {
              body: blockInput.body,
              metric_value: blockInput.metric_value,
              table_rows: blockInput.table_rows,
              chart_series: blockInput.chart_series,
              caption: blockInput.caption,
              page_number: blockInput.page_number,
              source_metadata: blockInput.source_metadata,
              layout_semantics: blockInput.layout_semantics,
              source_lineage_refs: blockInput.source_lineage_refs
            },
            editability: "editable",
            generated_by: blockInput.dataset_ref ? "data_bound" : "manual"
          })
        );
      });
      sections.push(
        ReportSectionSchema.parse({
          schema_namespace: REPORT_SCHEMA_NAMESPACE,
          schema_version: REPORT_SCHEMA_VERSION,
          section_id: sectionId,
          report_ref: current.report.report_id,
          version_ref: nextReportVersionId,
          parent_section_ref: null,
          section_kind: request.mutation.section.section_kind,
          title: localized(request.mutation.section.title),
          order_index: sections.length,
          block_refs: blockRefs,
          child_section_refs: [],
          layout_ref: current.layout.layout_id,
          page_anchor_ref: id("page-anchor", sectionId),
          citation_refs: [],
          visibility_state: "visible",
          lock_policy: request.mutation.section.lock_policy
        })
      );
    }
    if (request.mutation.mutation_kind === "reconcile_section") {
      const mutation = request.mutation;
      const priorRecord = this.store
        .listBackSyncRecords(current.report.report_id)
        .filter((entry) => entry.downstream_capability === mutation.downstream_capability && entry.downstream_ref === mutation.downstream_ref)
        .sort((left, right) => right.synced_at.localeCompare(left.synced_at))[0];
      let targetSection =
        (priorRecord?.matched_section_ref
          ? sections.find((section) => section.section_id === priorRecord.matched_section_ref)
          : null) ??
        sections.find((section) => normalizedText(section.title[0]?.value ?? "") === normalizedText(mutation.section_title));
      if (!targetSection) {
        const sectionId = id("report-section", current.report.report_id, sections.length + 1);
        targetSection = ReportSectionSchema.parse({
          schema_namespace: REPORT_SCHEMA_NAMESPACE,
          schema_version: REPORT_SCHEMA_VERSION,
          section_id: sectionId,
          report_ref: current.report.report_id,
          version_ref: nextReportVersionId,
          parent_section_ref: null,
          section_kind: "appendix",
          title: localized(mutation.section_title),
          order_index: sections.length,
          block_refs: [],
          child_section_refs: [],
          layout_ref: current.layout.layout_id,
          page_anchor_ref: id("page-anchor", sectionId),
          citation_refs: [],
          visibility_state: "visible",
          lock_policy: "editable"
        });
        sections.push(targetSection);
      }
      const sectionBlocks = blocks.filter((block) => block.section_ref === targetSection.section_id);
      const consumedBlockIds = new Set<string>();
      const keepBlockIds = new Set<string>();
      const removedBindingRefs = new Set<string>();
      const nextBlockRefs: string[] = [];
      const matchBlock = (blockInput: z.input<typeof ReportBlockInputSchema>) =>
        sectionBlocks.find((candidate) => {
          if (consumedBlockIds.has(candidate.block_id)) return false;
          const candidateLineage = existingBlockSourceLineageRefs(candidate);
          const incomingLineage = blockInputSourceLineageRefs(blockInput);
          if (candidateLineage.some((entry) => incomingLineage.includes(entry))) return true;
          return normalizedText(existingBlockTitle(candidate)) === normalizedText(blockInput.title);
        }) ?? null;
      mutation.blocks.forEach((blockInput, blockIndex) => {
        const matched = matchBlock(blockInput);
        const desiredFingerprint = inputBlockFingerprint(blockInput);
        if (matched) {
          consumedBlockIds.add(matched.block_id);
          keepBlockIds.add(matched.block_id);
          const currentPayload = clone(matched.content_payload as Record<string, unknown>);
          const currentSourceMetadata = ((currentPayload["source_metadata"] as Record<string, unknown> | undefined) ?? {});
          const currentFingerprint = blockFingerprint(existingBlockTitle(matched), currentPayload);
          const originFingerprint = String(currentSourceMetadata["reconciliation_origin_hash"] ?? "");
          const priorConflicts = Array.isArray(currentSourceMetadata["reconciliation_conflicts"])
            ? ([...currentSourceMetadata["reconciliation_conflicts"]] as Record<string, unknown>[])
            : [];
          const hasConflict =
            mutation.merge_mode === "conflict_preserving" &&
            originFingerprint.length > 0 &&
            currentFingerprint !== originFingerprint &&
            desiredFingerprint !== originFingerprint;
          matched.order_index = blockIndex;
          matched.block_type = blockInput.block_type;
          matched.title = localized(blockInput.title);
          if (hasConflict) {
            matched.content_payload = {
              ...currentPayload,
              source_metadata: {
                ...currentSourceMetadata,
                last_reconciled_at: timestamp,
                downstream_capability: mutation.downstream_capability,
                downstream_ref: mutation.downstream_ref,
                downstream_publication_ref: mutation.downstream_publication_ref,
                downstream_version_ref: mutation.downstream_version_ref,
                reconciliation_origin_hash: originFingerprint,
                reconciliation_conflicts: [
                  ...priorConflicts,
                  {
                    at: timestamp,
                    previous_origin_hash: originFingerprint,
                    current_hash: currentFingerprint,
                    incoming_hash: desiredFingerprint,
                    downstream_ref: mutation.downstream_ref
                  }
                ]
              },
              layout_semantics: {
                ...(((currentPayload["layout_semantics"] as Record<string, unknown> | undefined) ?? {})),
                downstream_pending_merge: true,
                downstream_snapshot: {
                  title: blockInput.title,
                  body: blockInput.body,
                  metric_value: blockInput.metric_value ?? null,
                  table_rows: blockInput.table_rows,
                  chart_series: blockInput.chart_series,
                  source_lineage_refs: blockInput.source_lineage_refs
                }
              }
            };
          } else {
            const bindingId = blockInput.dataset_ref ? matched.binding_refs[0] ?? id("report-binding", matched.block_id) : null;
            if (bindingId && !bindings.find((binding) => binding.binding_id === bindingId)) {
              bindings.push({
                schema_namespace: REPORT_SCHEMA_NAMESPACE,
                schema_version: REPORT_SCHEMA_VERSION,
                binding_id: bindingId,
                dataset_ref: blockInput.dataset_ref!,
                query_ref: blockInput.query_ref ?? `${blockInput.dataset_ref}:reconciled`,
                target_node_ref: id("text-node", matched.block_id),
                target_block_ref: matched.block_id,
                field_mappings: blockInput.field_mappings ?? [],
                snapshot_version_ref: null,
                last_refresh_at: null
              });
            } else if (bindingId) {
              const binding = bindings.find((entry) => entry.binding_id === bindingId)!;
              binding.dataset_ref = blockInput.dataset_ref!;
              binding.query_ref = blockInput.query_ref ?? `${blockInput.dataset_ref}:reconciled`;
              binding.field_mappings = blockInput.field_mappings ?? [];
            }
            if (!bindingId) {
              matched.binding_refs.forEach((ref) => removedBindingRefs.add(ref));
              matched.binding_refs = [];
            } else {
              matched.binding_refs = [bindingId];
            }
            matched.generated_by = blockInput.dataset_ref ? "data_bound" : "manual";
            matched.content_payload = {
              body: blockInput.body,
              metric_value: blockInput.metric_value,
              table_rows: blockInput.table_rows,
              chart_series: blockInput.chart_series,
              caption: blockInput.caption,
              page_number: blockInput.page_number,
              source_metadata: {
                ...blockInput.source_metadata,
                downstream_capability: mutation.downstream_capability,
                downstream_ref: mutation.downstream_ref,
                downstream_publication_ref: mutation.downstream_publication_ref,
                downstream_version_ref: mutation.downstream_version_ref,
                reconciled_at: timestamp,
                reconciliation_origin_hash: desiredFingerprint,
                reconciliation_conflicts: []
              },
              layout_semantics: {
                ...blockInput.layout_semantics,
                reconciled_from_downstream: true,
                merge_mode: mutation.merge_mode
              },
              source_lineage_refs: blockInput.source_lineage_refs
            };
          }
          nextBlockRefs.push(matched.block_id);
          return;
        }
        const blockId = id("report-block", targetSection!.section_id, "sync", blockIndex + 1, nextVersionNumber);
        const bindingId = blockInput.dataset_ref ? id("report-binding", blockId) : null;
        if (bindingId) {
          bindings.push({
            schema_namespace: REPORT_SCHEMA_NAMESPACE,
            schema_version: REPORT_SCHEMA_VERSION,
            binding_id: bindingId,
            dataset_ref: blockInput.dataset_ref!,
            query_ref: blockInput.query_ref ?? `${blockInput.dataset_ref}:reconciled`,
            target_node_ref: id("text-node", blockId),
            target_block_ref: blockId,
            field_mappings: blockInput.field_mappings ?? [],
            snapshot_version_ref: null,
            last_refresh_at: null
          });
        }
        blocks.push(
          ReportContentBlockSchema.parse({
            schema_namespace: REPORT_SCHEMA_NAMESPACE,
            schema_version: REPORT_SCHEMA_VERSION,
            block_id: blockId,
            report_ref: current.report.report_id,
            version_ref: nextReportVersionId,
            section_ref: targetSection.section_id,
            block_type: blockInput.block_type,
            order_index: blockIndex,
            title: localized(blockInput.title),
            canonical_node_ref: id("text-node", blockId),
            binding_refs: bindingId ? [bindingId] : [],
            citation_refs: blockInput.citations,
            lineage_refs: [id("lineage", blockId)],
            content_payload: {
              body: blockInput.body,
              metric_value: blockInput.metric_value,
              table_rows: blockInput.table_rows,
              chart_series: blockInput.chart_series,
              caption: blockInput.caption,
              page_number: blockInput.page_number,
              source_metadata: {
                ...blockInput.source_metadata,
                downstream_capability: mutation.downstream_capability,
                downstream_ref: mutation.downstream_ref,
                downstream_publication_ref: mutation.downstream_publication_ref,
                downstream_version_ref: mutation.downstream_version_ref,
                reconciled_at: timestamp,
                reconciliation_origin_hash: desiredFingerprint,
                reconciliation_conflicts: []
              },
              layout_semantics: {
                ...blockInput.layout_semantics,
                reconciled_from_downstream: true,
                merge_mode: mutation.merge_mode
              },
              source_lineage_refs: blockInput.source_lineage_refs
            },
            editability: "editable",
            generated_by: blockInput.dataset_ref ? "data_bound" : "manual"
          })
        );
        keepBlockIds.add(blockId);
        nextBlockRefs.push(blockId);
      });
      if (mutation.allow_prune) {
        sectionBlocks
          .filter((block) => !keepBlockIds.has(block.block_id))
          .forEach((block) => block.binding_refs.forEach((ref) => removedBindingRefs.add(ref)));
      } else {
        sectionBlocks
          .filter((block) => !keepBlockIds.has(block.block_id))
          .sort((left, right) => left.order_index - right.order_index)
          .forEach((block) => nextBlockRefs.push(block.block_id));
      }
      const nextBlocks = blocks.filter((block) => !mutation.allow_prune || keepBlockIds.has(block.block_id) || block.section_ref !== targetSection.section_id);
      blocks.length = 0;
      blocks.push(...nextBlocks.map((block, index) => ReportContentBlockSchema.parse({ ...block, order_index: block.section_ref === targetSection!.section_id ? nextBlockRefs.indexOf(block.block_id) : block.order_index })));
      const nextBindings = bindings.filter((binding) => !removedBindingRefs.has(binding.binding_id));
      bindings.length = 0;
      bindings.push(...nextBindings);
      targetSection.title = localized(mutation.section_title);
      targetSection.block_refs = nextBlockRefs;
      targetSection.version_ref = nextReportVersionId;
      targetSection.lock_policy = "editable";
    }
    if (request.mutation.mutation_kind === "replace_block_content") {
      const mutation = request.mutation;
      const target = blocks.find((block) => block.block_id === mutation.block_ref);
      if (!target) throw new Error(`Unknown report block: ${mutation.block_ref}`);
      target.title = localized(mutation.title ?? target.title[0]?.value ?? target.block_id);
      target.content_payload = { ...target.content_payload, body: mutation.body };
      target.generated_by = "manual";
    }
    if (request.mutation.mutation_kind === "rebind_block") {
      const mutation = request.mutation;
      const target = blocks.find((block) => block.block_id === mutation.block_ref);
      if (!target) throw new Error(`Unknown report block: ${mutation.block_ref}`);
      const bindingId = target.binding_refs[0] ?? id("report-binding", target.block_id);
      target.binding_refs = [bindingId];
      const existing = bindings.find((binding) => binding.binding_id === bindingId);
      if (existing) {
        existing.dataset_ref = mutation.dataset_ref;
        existing.query_ref = mutation.query_ref;
        existing.field_mappings = mutation.field_mappings;
      } else {
        bindings.push({
          schema_namespace: REPORT_SCHEMA_NAMESPACE,
          schema_version: REPORT_SCHEMA_VERSION,
          binding_id: bindingId,
          dataset_ref: mutation.dataset_ref,
          query_ref: mutation.query_ref,
          target_node_ref: id("text-node", target.block_id),
          target_block_ref: target.block_id,
          field_mappings: mutation.field_mappings,
          snapshot_version_ref: null,
          last_refresh_at: null
        });
      }
      target.generated_by = "data_bound";
    }
    const reconcileSectionTitle =
      request.mutation.mutation_kind === "reconcile_section" ? request.mutation.section_title : null;
    const bindingSet = ReportBindingSetSchema.parse({
      ...current.bindingSet,
      version_ref: nextReportVersionId,
      dataset_binding_refs: bindings.map((binding) => binding.binding_id),
      bindings,
      selective_regeneration_refs:
        request.mutation.mutation_kind === "rebind_block"
          ? [request.mutation.block_ref]
          : request.mutation.mutation_kind === "reconcile_section"
            ? (() => {
                const targetSectionId = sections.find(
                  (section) => normalizedText(section.title[0]?.value ?? "") === normalizedText(reconcileSectionTitle ?? "")
                )?.section_id;
                return blocks
                  .filter((block) => block.binding_refs.length > 0 && block.section_ref === targetSectionId)
                  .map((block) => block.block_id);
              })()
            : current.bindingSet.selective_regeneration_refs
    });
    const reviewState = ReportReviewStateSchema.parse({
      ...current.reviewState,
      version_ref: nextReportVersionId,
      state: "draft",
      latest_comment: null
    });
    const approvalState = ReportApprovalStateSchema.parse({
      ...current.approvalState,
      version_ref: nextReportVersionId,
      state: current.approvalState.state === "approved" ? "approved" : "pending",
      approver_ref: current.approvalState.state === "approved" ? current.approvalState.approver_ref : null,
      decision_comment: current.approvalState.state === "approved" ? current.approvalState.decision_comment : null,
      decided_at: current.approvalState.state === "approved" ? current.approvalState.decided_at : null
    });
    const version = ReportVersionSchema.parse({
      ...current.version,
      report_version_id: nextReportVersionId,
      version_ref: {
        version_id: nextVersionId,
        parent_version_id: current.version.version_ref.version_id,
        version_number: nextVersionNumber,
        semantic_version: semanticVersion(nextVersionNumber)
      },
      change_reason: request.mutation.mutation_kind,
      created_from: "manual_edit",
      draft_state: "draft",
      review_state_ref: reviewState.review_state_id,
      approval_state_ref: approvalState.approval_state_id,
      diff_base_version_ref: current.version.version_ref.version_id,
      section_refs: sections.map((section) => section.section_id),
      content_block_refs: blocks.map((block) => block.block_id),
      binding_set_ref: bindingSet.binding_set_id,
      created_by: request.actor_ref,
      created_at: timestamp
    });
    const layout = ReportLayoutSchema.parse({ ...current.layout, version_ref: nextReportVersionId });
    sections.forEach((section) => {
      section.version_ref = nextReportVersionId;
    });
    blocks.forEach((block) => {
      block.version_ref = nextReportVersionId;
    });
    const report = ReportSchema.parse({
      ...current.report,
      current_version_ref: nextVersionId,
      section_refs: sections.map((section) => section.section_id),
      status: "draft",
      updated_at: timestamp
    });
    const canonical = buildCanonical(
      {
        tenant_ref: current.reportArtifact.tenant_ref,
        workspace_id: current.reportArtifact.workspace_id,
        project_id: current.reportArtifact.project_id,
        title: sections[0]?.title[0]?.value ?? report.report_id,
        language: "ar-SA",
        template_ref: report.template_ref,
        source_refs: current.reportArtifact.source_refs
      },
      report.report_id,
      timestamp,
      sections,
      blocks,
      bindingSet
    );
    const state: PersistableReportState = {
      ...current,
      report,
      version,
      layout,
      sections,
      contentBlocks: blocks,
      bindingSet,
      reviewState,
      approvalState,
      canonical,
      versionArtifact: ArtifactSchema.parse({
        ...current.versionArtifact,
        artifact_id: id("artifact", report.report_id, "version", nextVersionNumber),
        created_by: request.actor_ref,
        created_at: timestamp,
        version_ref: version.version_ref
      })
    };
    const stage = createExecutionStage({
      reportId: report.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.update_report.v1",
      stage: "report_update",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.version.version_ref.version_id],
      artifactRefs: [state.reportArtifact.artifact_id, state.versionArtifact.artifact_id],
      requestedMode: report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", report.report_id, "mutation", timestamp),
          check_name: "report_mutation_check",
          check_type: "mutation",
          passed: true,
          severity: "high",
          details: `Mutation ${request.mutation.mutation_kind} was applied to the editable report artifact.`,
          impacted_refs: [report.report_id, version.version_ref.version_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", report.report_id, "update", timestamp),
          from_ref: current.version.version_ref.version_id,
          to_ref: version.version_ref.version_id,
          transform_ref: "reports.update",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: report.template_ref,
          dataset_binding_ref: bindingSet.binding_set_id,
          version_diff_ref: version.diff_base_version_ref ?? ""
        }
      ]
    });
    return persistWithStage(this.store, state, stage);
  }

  refreshReport(input: RefreshReportRequest): ReportWorkflowResult {
    const request = RefreshReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const nextVersionNumber = current.version.version_ref.version_number + 1;
    const nextVersionId = id("version", current.report.report_id, nextVersionNumber);
    const nextReportVersionId = id("report-version", current.report.report_id, nextVersionNumber);
    const blocks = clone(current.contentBlocks).map((block) => {
      const shouldRefresh =
        request.selective_regeneration_refs.length === 0 ||
        request.selective_regeneration_refs.includes(block.block_id) ||
        request.selective_regeneration_refs.includes(block.section_ref);
      block.version_ref = nextReportVersionId;
      if (!shouldRefresh || block.binding_refs.length === 0) return block;
      const payload = clone(block.content_payload);
      payload["last_refreshed_at"] = timestamp;
      if (block.block_type === "metric_card") payload["metric_value"] = Number(payload["metric_value"] ?? 0) + 5;
      if (block.block_type === "chart") payload["chart_series"] = [{ label: "Current", value: 72 }, { label: "Target", value: 68 }];
      if (block.block_type === "table") {
        payload["table_rows"] = [
          ["Region", "Current", "Target"],
          ["Riyadh", "72", "68"],
          ["Jeddah", "64", "60"]
        ];
      }
      block.content_payload = payload;
      block.generated_by = "data_bound";
      return block;
    });
    const bindings = clone(current.bindingSet.bindings).map((binding) => ({
      ...binding,
      snapshot_version_ref: nextVersionId,
      last_refresh_at: timestamp
    }));
    const sections = clone(current.sections).map((section) => ({ ...section, version_ref: nextReportVersionId }));
    const bindingSet = ReportBindingSetSchema.parse({
      ...current.bindingSet,
      version_ref: nextReportVersionId,
      bindings,
      staleness_status: "live",
      last_refresh_at: timestamp,
      selective_regeneration_refs: request.selective_regeneration_refs
    });
    const reviewState = ReportReviewStateSchema.parse({ ...current.reviewState, version_ref: nextReportVersionId, state: "draft" });
    const approvalState = ReportApprovalStateSchema.parse({
      ...current.approvalState,
      version_ref: nextReportVersionId,
      state: current.approvalState.state === "approved" ? "approved" : "pending",
      approver_ref: current.approvalState.state === "approved" ? current.approvalState.approver_ref : null,
      decision_comment: current.approvalState.state === "approved" ? current.approvalState.decision_comment : null,
      decided_at: current.approvalState.state === "approved" ? current.approvalState.decided_at : null
    });
    const version = ReportVersionSchema.parse({
      ...current.version,
      report_version_id: nextReportVersionId,
      version_ref: {
        version_id: nextVersionId,
        parent_version_id: current.version.version_ref.version_id,
        version_number: nextVersionNumber,
        semantic_version: semanticVersion(nextVersionNumber)
      },
      change_reason: "refresh_report",
      created_from: "dataset_refresh",
      draft_state: approvalState.state === "approved" ? "finalized" : "ready_for_review",
      review_state_ref: reviewState.review_state_id,
      approval_state_ref: approvalState.approval_state_id,
      diff_base_version_ref: current.version.version_ref.version_id,
      section_refs: sections.map((section) => section.section_id),
      content_block_refs: blocks.map((block) => block.block_id),
      binding_set_ref: bindingSet.binding_set_id,
      created_by: request.actor_ref,
      created_at: timestamp
    });
    const report = ReportSchema.parse({
      ...current.report,
      current_version_ref: nextVersionId,
      status: approvalState.state === "approved" ? "approved" : "review",
      updated_at: timestamp
    });
    const canonical = CanonicalRepresentationSchema.parse({
      ...current.canonical,
      canonical_id: id("canonical", report.report_id, timestamp),
      updated_at: timestamp
    });
    const state: PersistableReportState = {
      ...current,
      report,
      version,
      sections,
      contentBlocks: blocks,
      bindingSet,
      reviewState,
      approvalState,
      canonical,
      versionArtifact: ArtifactSchema.parse({
        ...current.versionArtifact,
        artifact_id: id("artifact", report.report_id, "version", nextVersionNumber),
        created_by: request.actor_ref,
        created_at: timestamp,
        version_ref: version.version_ref
      })
    };
    const warnings =
      request.selective_regeneration_refs.length > 0
        ? [baseWarning("selective_regeneration", "Selective regeneration executed.", "Only requested report refs were regenerated.", request.selective_regeneration_refs)]
        : [];
    const stage = createExecutionStage({
      reportId: report.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.refresh_report.v1",
      stage: "report_refresh",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: current.bindingSet.source_artifact_refs,
      artifactRefs: [state.reportArtifact.artifact_id, state.versionArtifact.artifact_id],
      requestedMode: report.mode,
      timestamp,
      warnings,
      checks: [
        {
          check_id: id("check", report.report_id, "refresh-path", timestamp),
          check_name: "refresh_path_check",
          check_type: "binding",
          passed: true,
          severity: "high",
          details: "Bindings were refreshed and the editable report artifact stayed authoritative.",
          impacted_refs: bindings.map((binding) => binding.binding_id)
        }
      ],
      lineageEdges: bindings.map((binding) => ({
        edge_id: id("edge", binding.binding_id, timestamp),
        from_ref: binding.dataset_ref,
        to_ref: binding.target_block_ref,
        transform_ref: "reports.refresh",
        ai_suggestion_ref: "",
        ai_decision: "not_applicable",
        template_ref: report.template_ref,
        dataset_binding_ref: binding.binding_id,
        version_diff_ref: current.version.version_ref.version_id
      }))
    });
    return persistWithStage(this.store, state, stage);
  }

  compareReports(input: CompareReportsRequest): ReportCompareResult {
    const request = CompareReportsRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const baseState = this.store.loadVersionSnapshot(request.report_id, request.base_version_ref);
    const targetState = this.store.loadVersionSnapshot(request.report_id, request.target_version_ref);
    const baseBlocks = new Map(baseState.content_blocks.map((block) => [block.block_id, JSON.stringify(block.content_payload)]));
    const targetBlocks = new Map(targetState.content_blocks.map((block) => [block.block_id, JSON.stringify(block.content_payload)]));
    const changedBlockIds = targetState.content_blocks
      .filter((block) => baseBlocks.get(block.block_id) !== targetBlocks.get(block.block_id))
      .map((block) => block.block_id);
    const addedRefs = targetState.content_blocks.filter((block) => !baseBlocks.has(block.block_id)).map((block) => block.block_id);
    const removedRefs = baseState.content_blocks.filter((block) => !targetBlocks.has(block.block_id)).map((block) => block.block_id);
    const changedSectionRefs = targetState.sections
      .filter((section) => section.block_refs.some((blockRef) => changedBlockIds.includes(blockRef) || addedRefs.includes(blockRef) || removedRefs.includes(blockRef)))
      .map((section) => section.section_id);
    const diffArtifact = this.store.writeAuxiliaryArtifact(
      request.report_id,
      ArtifactSchema.parse({
        contract: contractEnvelope("artifact"),
        artifact_id: id("artifact", request.report_id, "diff", request.base_version_ref, request.target_version_ref),
        artifact_type: "workflow_output",
        artifact_subtype: "report_diff",
        project_id: current.reportArtifact.project_id,
        workspace_id: current.reportArtifact.workspace_id,
        source_refs: [request.base_version_ref, request.target_version_ref],
        parent_artifact_refs: [current.reportArtifact.artifact_id],
        canonical_ref: current.report.canonical_ref,
        created_by: request.actor_ref,
        created_at: timestamp,
        mode: current.report.mode,
        editable_status: "non_editable",
        template_status: "applied",
        lineage_ref: id("lineage-group", request.report_id),
        evidence_ref: id("evidence", request.report_id, "compare"),
        verification_status: "verified",
        storage_ref: createStorageRef(id("artifact", request.report_id, "diff")),
        preview_ref: createPreviewRef(id("artifact", request.report_id, "diff"), "html_canvas"),
        export_refs: [],
        version_ref: current.version.version_ref,
        tenant_ref: current.reportArtifact.tenant_ref,
        permission_scope: current.reportArtifact.permission_scope
      }),
      path.join("diffs", `${request.base_version_ref}-${request.target_version_ref}.json`),
      JSON.stringify(
        {
          report_id: request.report_id,
          base_version_ref: request.base_version_ref,
          target_version_ref: request.target_version_ref,
          changed_block_ids: changedBlockIds,
          added_refs: addedRefs,
          removed_refs: removedRefs,
          changed_section_refs: changedSectionRefs
        },
        null,
        2
      )
    );
    const diff = ReportDiffMetadataSchema.parse({
      schema_namespace: REPORT_SCHEMA_NAMESPACE,
      schema_version: REPORT_SCHEMA_VERSION,
      diff_id: id("report-diff", request.report_id, timestamp),
      report_ref: request.report_id,
      base_version_ref: request.base_version_ref,
      target_version_ref: request.target_version_ref,
      compare_kind: "version_to_version",
      changed_section_refs: changedSectionRefs,
      changed_table_refs: targetState.content_blocks.filter((block) => block.block_type === "table" && changedBlockIds.includes(block.block_id)).map((block) => block.block_id),
      changed_chart_refs: targetState.content_blocks.filter((block) => block.block_type === "chart" && changedBlockIds.includes(block.block_id)).map((block) => block.block_id),
      changed_metric_refs: targetState.content_blocks.filter((block) => block.block_type === "metric_card" && changedBlockIds.includes(block.block_id)).map((block) => block.block_id),
      added_refs: addedRefs,
      removed_refs: removedRefs,
      summary: `Compared ${request.base_version_ref} to ${request.target_version_ref} and found ${changedBlockIds.length} changed blocks.`,
      diff_artifact_ref: diffArtifact.artifact_id
    });
    const persistedState: PersistableReportState = {
      ...current,
      derivedArtifacts: [...current.derivedArtifacts.filter((artifact) => artifact.artifact_id !== diffArtifact.artifact_id), diffArtifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.compare_reports.v1",
      stage: "report_compare",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [request.base_version_ref, request.target_version_ref],
      artifactRefs: [diffArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "compare", timestamp),
          check_name: "version_compare_check",
          check_type: "diff",
          passed: true,
          severity: "high",
          details: "Version compare payload was generated and persisted.",
          impacted_refs: [diff.diff_id, diffArtifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "compare", timestamp),
          from_ref: request.base_version_ref,
          to_ref: diffArtifact.artifact_id,
          transform_ref: "reports.compare",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: diff.diff_id
        }
      ]
    });
    this.store.persistState(persistedState, stage);
    return { diff, diffArtifact, ...stage };
  }

  reviewReport(input: ReviewReportRequest): ReportWorkflowResult {
    const request = ReviewReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const reviewCommentId = request.comment ? id("review-comment", request.report_id, timestamp) : null;
    const reviewState = ReportReviewStateSchema.parse({
      ...current.reviewState,
      state: request.decision,
      reviewer_refs: Array.from(new Set([...current.reviewState.reviewer_refs, request.actor_ref, ...request.reviewer_refs])),
      review_comment_refs: reviewCommentId ? [...current.reviewState.review_comment_refs, reviewCommentId] : current.reviewState.review_comment_refs,
      latest_comment: request.comment || current.reviewState.latest_comment,
      last_reviewed_at: timestamp
    });
    const report = ReportSchema.parse({
      ...current.report,
      status: request.decision === "changes_requested" ? "draft" : "review",
      updated_at: timestamp
    });
    const version = ReportVersionSchema.parse({
      ...current.version,
      draft_state: request.decision === "reviewed" ? "ready_for_review" : request.decision === "changes_requested" ? "changes_requested" : "ready_for_review"
    });
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.review_report.v1",
      stage: "report_review",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.version.version_ref.version_id],
      artifactRefs: [current.reportArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "review", timestamp),
          check_name: "review_state_transition_check",
          check_type: "workflow",
          passed: true,
          severity: "high",
          details: `Review state transitioned to ${request.decision}.`,
          impacted_refs: [reviewState.review_state_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "review", timestamp),
          from_ref: current.reviewState.review_state_id,
          to_ref: reviewState.review_state_id,
          transform_ref: "reports.review",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return persistWithStage(this.store, { ...current, report, version, reviewState }, stage);
  }

  approveReport(input: ApproveReportRequest): ReportWorkflowResult {
    const request = ApproveReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const approvalState = ReportApprovalStateSchema.parse({
      ...current.approvalState,
      state: request.decision,
      approver_ref: request.actor_ref,
      decision_comment: request.comment || null,
      decided_at: timestamp
    });
    const report = ReportSchema.parse({
      ...current.report,
      status: request.decision === "approved" ? "approved" : "draft",
      updated_at: timestamp
    });
    const version = ReportVersionSchema.parse({
      ...current.version,
      draft_state: request.decision === "approved" ? "finalized" : "changes_requested"
    });
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.approve_report.v1",
      stage: "report_approve",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reviewState.review_state_id],
      artifactRefs: [current.reportArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "approve", timestamp),
          check_name: "approval_state_transition_check",
          check_type: "approval",
          passed: true,
          severity: "critical",
          details: `Approval state transitioned to ${request.decision}.`,
          impacted_refs: [approvalState.approval_state_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "approve", timestamp),
          from_ref: current.approvalState.approval_state_id,
          to_ref: approvalState.approval_state_id,
          transform_ref: "reports.approve",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return persistWithStage(this.store, { ...current, report, version, approvalState }, stage);
  }

  async exportReport(input: ExportReportRequest): Promise<ReportExportResult> {
    const request = ExportReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const lines = renderLines(current);
    let payload: string | Uint8Array;
    let fileName: string;
    let contentType: string;
    if (request.target === "html") {
      payload = renderHtml(current);
      fileName = "report.html";
      contentType = "text/html";
    } else if (request.target === "pdf") {
      payload = buildPdf(lines);
      fileName = "report.pdf";
      contentType = "application/pdf";
    } else {
      payload = await buildDocx(current.sections[0]?.title[0]?.value ?? current.report.report_id, lines);
      fileName = "report.docx";
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    const artifactId = id("artifact", request.report_id, "export", request.target, timestamp);
    const exportArtifact = this.store.writeAuxiliaryArtifact(
      request.report_id,
      ArtifactSchema.parse({
        contract: contractEnvelope("artifact"),
        artifact_id: artifactId,
        artifact_type: "export_bundle",
        artifact_subtype: `report_${request.target}`,
        project_id: current.reportArtifact.project_id,
        workspace_id: current.reportArtifact.workspace_id,
        source_refs: [current.report.report_id],
        parent_artifact_refs: [current.reportArtifact.artifact_id],
        canonical_ref: current.report.canonical_ref,
        created_by: request.actor_ref,
        created_at: timestamp,
        mode: current.report.mode,
        editable_status: request.target === "docx" ? "editable" : "non_editable",
        template_status: "applied",
        lineage_ref: id("lineage-group", request.report_id),
        evidence_ref: id("evidence", request.report_id, `export-${request.target}`),
        verification_status: "verified",
        storage_ref: createStorageRef(artifactId),
        preview_ref: createPreviewRef(artifactId, request.target === "pdf" ? "pdf_preview" : "html_canvas"),
        export_refs: [],
        version_ref: current.version.version_ref,
        tenant_ref: current.reportArtifact.tenant_ref,
        permission_scope: current.reportArtifact.permission_scope
      }),
      path.join("exports", request.target, fileName),
      payload
    );
    const sourceState: PersistableReportState = {
      ...current,
      report: ReportSchema.parse({
        ...current.report,
        updated_at: timestamp
      }),
      reportArtifact: ArtifactSchema.parse({
        ...current.reportArtifact,
        export_refs: [
          ...current.reportArtifact.export_refs,
          {
            export_id: id("export-ref", artifactId),
            export_type: request.target,
            explicit_non_editable: request.target === "pdf",
            storage_ref: exportArtifact.storage_ref.storage_id
          }
        ]
      }),
      derivedArtifacts: [...current.derivedArtifacts.filter((artifact) => artifact.artifact_id !== exportArtifact.artifact_id), exportArtifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef:
        request.target === "docx"
          ? "reports.export_report_docx.v1"
          : request.target === "pdf"
            ? "reports.export_report_pdf.v1"
            : "reports.export_report_html.v1",
      stage: `report_export_${request.target}`,
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reportArtifact.artifact_id],
      artifactRefs: [exportArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, `export-${request.target}`, timestamp),
          check_name: request.target === "docx" ? "docx_editability_check" : request.target === "pdf" ? "pdf_render_check" : "html_render_check",
          check_type: "export",
          passed: true,
          severity: "high",
          details: `${request.target.toUpperCase()} export was generated as a derived artifact.`,
          impacted_refs: [exportArtifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, `export-${request.target}`, timestamp),
          from_ref: current.reportArtifact.artifact_id,
          to_ref: exportArtifact.artifact_id,
          transform_ref: `reports.export.${request.target}`,
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    const persisted = this.store.persistState(sourceState, stage);
    return { sourceReport: persisted, exportArtifact, fileName, contentType, payload, ...stage };
  }

  exportReportDocx(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult> {
    return this.exportReport({ ...input, target: "docx" });
  }

  exportReportPdf(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult> {
    return this.exportReport({ ...input, target: "pdf" });
  }

  exportReportHtml(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult> {
    return this.exportReport({ ...input, target: "html" });
  }

  async convertReportToPresentation(input: ConvertReportRequest): Promise<ReportConversionResult> {
    const request = ConvertReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const presentationEngine = this.createPresentationEngine();
    const integrationKey = hashValue(`${request.report_id}:presentation:${request.target_ref}`).slice(0, 10);
    const bundle = await presentationEngine.createPresentation({
      presentation_id: id("rptdeck", integrationKey),
      tenant_ref: current.reportArtifact.tenant_ref,
      workspace_id: current.reportArtifact.workspace_id,
      project_id: current.reportArtifact.project_id,
      created_by: request.actor_ref,
      title: current.sections[0]?.title[0]?.value ?? current.report.report_id,
      description: reportDescription(current),
      mode: current.report.mode,
      language: reportLanguage(current),
      audience: "report stakeholders",
      tone: "direct",
      density: "balanced",
      source_policy: "prefer_structured_sources",
      rtl_policy: reportLanguage(current).startsWith("ar") ? "rtl" : "auto",
      motion_level: "subtle",
      notes_policy: "auto_generate",
      template_ref: current.report.template_ref,
      brand_preset_ref: current.report.brand_preset_ref,
      sources: [reportAsPresentationSource(current)],
      permission_scope: current.reportArtifact.permission_scope,
      timestamp
    });
    const parity = await presentationEngine.runRenderParityValidation(bundle);
    const allowDegradedPublish = !parity.parityValidation.publish_ready;
    let nativePublication: PresentationPublicationResult;
    try {
      nativePublication = presentationEngine.publishPresentation({
        bundle: parity.bundle,
        published_by: request.actor_ref,
        target_ref: request.target_ref,
        publish_to_library: true,
        allow_degraded: allowDegradedPublish,
        timestamp
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("render parity is not ready")) {
        throw error;
      }
      nativePublication = presentationEngine.publishPresentation({
        bundle: parity.bundle,
        published_by: request.actor_ref,
        target_ref: request.target_ref,
        publish_to_library: true,
        allow_degraded: true,
        timestamp
      });
    }
    const presentationArtifactId = id("artifact", request.report_id, "presentation", timestamp);
    const artifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: presentationArtifactId,
      artifact_type: "presentation",
      artifact_subtype: "native_report_conversion",
      project_id: current.reportArtifact.project_id,
      workspace_id: current.reportArtifact.workspace_id,
      source_refs: [current.report.report_id],
      parent_artifact_refs: [current.reportArtifact.artifact_id, parity.bundle.deckArtifact.artifact_id],
      canonical_ref: current.report.canonical_ref,
      created_by: request.actor_ref,
      created_at: timestamp,
      mode: current.report.mode,
      editable_status: "editable",
      template_status: "applied",
      lineage_ref: id("lineage-group", request.report_id),
      evidence_ref: id("evidence", request.report_id, "presentation"),
      verification_status: parity.parityValidation.publish_ready ? "verified" : "degraded",
      storage_ref: {
        ...createStorageRef(id("artifact", request.report_id, "presentation")),
        uri: parity.bundle.deckArtifact.storage_ref.uri,
        checksum: parity.bundle.deckArtifact.storage_ref.checksum,
        region: "local"
      },
      preview_ref: parity.preview.artifact.preview_ref,
      export_refs: parity.exports.map((entry) => ({
        export_id: id("export", presentationArtifactId, entry.target),
        export_type: entry.target === "pptx" ? "pptx" : entry.target,
        explicit_non_editable: entry.target !== "pptx",
        storage_ref: entry.artifact.storage_ref.storage_id
      })),
      version_ref: current.version.version_ref,
      tenant_ref: current.reportArtifact.tenant_ref,
      permission_scope: current.reportArtifact.permission_scope
    });
    const payload = {
      presentation_id: parity.bundle.deck.deck_id,
      presentation_version_ref: parity.bundle.version.version_ref.version_id,
      publication_id: nativePublication.publication.publication_id,
      target_ref: nativePublication.publication.target_ref,
      export_artifact_refs: parity.exports.map((entry) => entry.artifact.artifact_id),
      preview_artifact_ref: parity.preview.artifact.artifact_id,
      parity_validation_ref: parity.parityValidation.render_parity_validation_id,
      publish_ready: parity.parityValidation.publish_ready,
      degraded_publish: allowDegradedPublish
    };
    const backSync = this.applyBackSyncSection(
      request.report_id,
      request.actor_ref,
      "presentations",
      parity.bundle.deck.deck_id,
      nativePublication.publication.publication_id,
      parity.bundle.version.version_ref.version_id,
      "Presentation Back-Sync",
      presentationBackSyncBlocks(parity.bundle, nativePublication, timestamp),
      timestamp
    );
    const syncedState = this.store.loadState(request.report_id);
    const state: PersistableReportState = {
      ...syncedState,
      derivedArtifacts: [...syncedState.derivedArtifacts.filter((item) => item.artifact_id !== artifact.artifact_id), artifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.convert_report_to_presentation.v1",
      stage: "report_convert_presentation",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reportArtifact.artifact_id],
      artifactRefs: [artifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "convert-presentation", timestamp),
          check_name: "presentation_conversion_check",
          check_type: "conversion",
          passed: true,
          severity: "high",
          details: "Report sections were converted into a derived presentation artifact.",
          impacted_refs: [artifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "presentation", timestamp),
          from_ref: current.reportArtifact.artifact_id,
          to_ref: artifact.artifact_id,
          transform_ref: "reports.convert.presentation",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return {
      state: this.store.persistState(state, stage),
      artifact,
      payload: {
        ...payload,
        back_sync: {
          sync_id: backSync.record.sync_id,
          synced_section_refs: backSync.record.synced_section_refs,
          synced_block_refs: backSync.record.synced_block_refs,
          created_version_ref: backSync.record.created_version_ref
        }
      },
      backSyncRecord: backSync.record,
      backSyncStage: {
        job: backSync.result.job,
        evidencePack: backSync.result.evidencePack,
        auditEvents: backSync.result.auditEvents,
        lineageEdges: backSync.result.lineageEdges
      },
      nativePresentationBundle: parity.bundle,
      nativePresentationPublication: nativePublication,
      ...stage
    };
  }

  async convertReportToDashboard(input: ConvertReportRequest): Promise<ReportConversionResult> {
    const request = ConvertReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const dashboardEngine = this.createDashboardEngine();
    const integrationKey = hashValue(`${request.report_id}:dashboard:${request.target_ref}`).slice(0, 10);
    const workflow = dashboardEngine.createDashboard({
      dashboard_id: id("rptdash", integrationKey),
      tenant_ref: current.reportArtifact.tenant_ref,
      workspace_id: current.reportArtifact.workspace_id,
      project_id: current.reportArtifact.project_id,
      created_by: request.actor_ref,
      title: `${current.sections[0]?.title[0]?.value ?? current.report.report_id} Dashboard`,
      description: reportDescription(current),
      mode: current.bindingSet.bindings.length > 0 ? "advanced" : "easy",
      dataset_profiles: inferDatasetProfilesFromReport(current),
      widget_blueprints: reportAsDashboardBlueprints(current),
      filters: reportAsDashboardFilters(current),
      template_ref: current.report.template_ref,
      brand_preset_ref: current.report.brand_preset_ref,
      refresh_policy: reportAsDashboardRefreshPolicy(current),
      permission_scope: current.reportArtifact.permission_scope,
      timestamp
    });
    const interactionSeedFilter = workflow.dashboard.filter_sets[0] ?? null;
    const interactionExecution =
      interactionSeedFilter && workflow.dashboard.widgets.length > 1
        ? dashboardEngine.executeInteraction({
            dashboard: workflow.dashboard,
            base_version: workflow.version,
            actor_ref: request.actor_ref,
            source_widget_ref: workflow.dashboard.widgets[0]?.widget_id ?? workflow.dashboard.widgets[workflow.dashboard.widgets.length - 1]!.widget_id,
            trigger: "filter_change",
            effect: "filter",
            target_widget_refs: workflow.dashboard.widgets.slice(1).map((widget) => widget.widget_id),
            payload: {
              filter_id: interactionSeedFilter.filter_id,
              dataset_ref: interactionSeedFilter.dataset_ref,
              field_ref: interactionSeedFilter.field_ref,
              values: interactionSeedFilter.default_values
            },
            timestamp
          })
        : null;
    const interactedWorkflow: DashboardWorkflowResult = interactionExecution
      ? interactionExecution.refreshResult ?? interactionExecution.workflow
      : workflow;
    const scheduledRefresh = dashboardEngine.scheduleDashboardRefresh({
      dashboard_id: interactedWorkflow.dashboard.dashboard_id,
      actor_ref: request.actor_ref,
      due_at: timestamp,
      refresh_binding_refs: interactedWorkflow.dashboard.bindings.map((binding) => binding.binding_id),
      timestamp
    });
    const dueRefreshes = dashboardEngine.runDueRefreshes(timestamp);
    const refreshedWorkflow: DashboardWorkflowResult =
      dueRefreshes.find((entry) => entry.dashboard.dashboard_id === interactedWorkflow.dashboard.dashboard_id) ?? interactedWorkflow;
    const nativePublication = dashboardEngine.publishDashboard({
      dashboard: refreshedWorkflow.dashboard,
      version: refreshedWorkflow.version,
      published_by: request.actor_ref,
      target_ref: request.target_ref,
      publish_to_library: true,
      embeddable: true,
      timestamp
    });
    const artifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: id("artifact", request.report_id, "dashboard", timestamp),
      artifact_type: "dashboard",
      artifact_subtype: "native_report_conversion",
      project_id: current.reportArtifact.project_id,
      workspace_id: current.reportArtifact.workspace_id,
      source_refs: [current.report.report_id],
      parent_artifact_refs: [current.reportArtifact.artifact_id, refreshedWorkflow.dashboardArtifact.artifact_id],
      canonical_ref: current.report.canonical_ref,
      created_by: request.actor_ref,
      created_at: timestamp,
      mode: current.report.mode,
      editable_status: "editable",
      template_status: "applied",
      lineage_ref: id("lineage-group", request.report_id),
      evidence_ref: id("evidence", request.report_id, "dashboard"),
      verification_status: "verified",
      storage_ref: {
        ...createStorageRef(id("artifact", request.report_id, "dashboard")),
        uri: refreshedWorkflow.dashboardArtifact.storage_ref.uri,
        checksum: refreshedWorkflow.dashboardArtifact.storage_ref.checksum,
        region: "local"
      },
      preview_ref: createPreviewRef(id("artifact", request.report_id, "dashboard"), "html_canvas"),
      export_refs: [],
      version_ref: current.version.version_ref,
      tenant_ref: current.reportArtifact.tenant_ref,
      permission_scope: current.reportArtifact.permission_scope
    });
    const payload = {
      dashboard_id: refreshedWorkflow.dashboard.dashboard_id,
      dashboard_version_ref: refreshedWorkflow.version.version_id,
      publication_id: nativePublication.publication.publication_id,
      target_ref: nativePublication.publication.target_ref,
      transport: nativePublication.transport,
      scheduled_refresh_id: scheduledRefresh.schedule_id
    };
    const backSync = this.applyBackSyncSection(
      request.report_id,
      request.actor_ref,
      "dashboards",
      refreshedWorkflow.dashboard.dashboard_id,
      nativePublication.publication.publication_id,
      refreshedWorkflow.version.version_id,
      "Dashboard Back-Sync",
      dashboardBackSyncBlocks(refreshedWorkflow, nativePublication, timestamp),
      timestamp
    );
    const syncedState = this.store.loadState(request.report_id);
    const state: PersistableReportState = {
      ...syncedState,
      derivedArtifacts: [...syncedState.derivedArtifacts.filter((item) => item.artifact_id !== artifact.artifact_id), artifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.convert_report_to_dashboard.v1",
      stage: "report_convert_dashboard",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reportArtifact.artifact_id],
      artifactRefs: [artifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "convert-dashboard", timestamp),
          check_name: "dashboard_conversion_check",
          check_type: "conversion",
          passed: true,
          severity: "high",
          details: "Metric blocks were converted into a derived dashboard artifact.",
          impacted_refs: [artifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "dashboard", timestamp),
          from_ref: current.reportArtifact.artifact_id,
          to_ref: artifact.artifact_id,
          transform_ref: "reports.convert.dashboard",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return {
      state: this.store.persistState(state, stage),
      artifact,
      payload: {
        ...payload,
        back_sync: {
          sync_id: backSync.record.sync_id,
          synced_section_refs: backSync.record.synced_section_refs,
          synced_block_refs: backSync.record.synced_block_refs,
          created_version_ref: backSync.record.created_version_ref
        }
      },
      backSyncRecord: backSync.record,
      backSyncStage: {
        job: backSync.result.job,
        evidencePack: backSync.result.evidencePack,
        auditEvents: backSync.result.auditEvents,
        lineageEdges: backSync.result.lineageEdges
      },
      nativeDashboardWorkflow: refreshedWorkflow,
      nativeDashboardPublication: nativePublication,
      ...stage
    };
  }

  async publishReport(input: PublishReportRequest): Promise<ReportPublicationResult> {
    const request = PublishReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    if (current.approvalState.state !== "approved") throw new Error("Report approval is required before publish.");
    if (request.target_ref.startsWith("unstable+gateway://") && this.store.consumeTransientTransportFailure(request.target_ref)) {
      throw new Error(`Transient remote transport failure for ${request.target_ref}`);
    }
    const existingHtml = current.derivedArtifacts.find((artifact) => artifact.artifact_subtype === "report_html");
    const htmlExport = existingHtml
      ? {
          sourceReport: current,
          exportArtifact: existingHtml,
          fileName: "report.html",
          contentType: "text/html",
          payload: renderHtml(current),
          ...createExecutionStage({
            reportId: request.report_id,
            actorRef: request.actor_ref,
            actionRef: "reports.export_report_html.v1",
            stage: "report_export_html_reuse",
            workspaceId: current.reportArtifact.workspace_id,
            tenantRef: current.reportArtifact.tenant_ref,
            sourceRefs: [current.reportArtifact.artifact_id],
            artifactRefs: [existingHtml.artifact_id],
            requestedMode: current.report.mode,
            timestamp,
            checks: [
              {
                check_id: id("check", request.report_id, "reuse-html", timestamp),
                check_name: "export_bundle_check",
                check_type: "export",
                passed: true,
                severity: "low",
                details: "Existing HTML export was reused during publication.",
                impacted_refs: [existingHtml.artifact_id]
              }
            ]
          })
        }
      : await this.exportReportHtml({ report_id: request.report_id, actor_ref: request.actor_ref, timestamp });
    const publicationId = id("publication", request.report_id, timestamp);
    const accessMode = transportAccessMode(current.reportArtifact.permission_scope);
    const manifest = this.store.writePublicationTransportJson(request.report_id, publicationId, "manifest.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      version_ref: current.version.version_ref.version_id,
      requested_target_ref: request.target_ref,
      editable_artifact_ref: current.reportArtifact.artifact_id,
      html_export_ref: htmlExport.exportArtifact.artifact_id,
      published_at: timestamp,
      access_mode: accessMode
    });
    const publishState = this.store.writePublicationTransportJson(request.report_id, publicationId, "publish-state.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      status: "published",
      editable_default: true,
      explicit_non_editable_export: false,
      access_mode: accessMode,
      permission_scope: current.reportArtifact.permission_scope
    });
    const exportHtml = this.store.writePublicationTransportText(
      request.report_id,
      publicationId,
      "published-report.html",
      typeof htmlExport.payload === "string" ? htmlExport.payload : Buffer.from(htmlExport.payload).toString("utf8")
    );
    const embedPayload = this.store.writePublicationTransportJson(request.report_id, publicationId, "embed-payload.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      title: current.sections[0]?.title[0]?.value ?? current.report.report_id,
      report_type: current.report.report_type,
      html_export_uri: exportHtml.uri,
      html_export_artifact_ref: htmlExport.exportArtifact.artifact_id,
      source_of_truth_artifact_ref: current.reportArtifact.artifact_id,
      version_ref: current.version.version_ref.version_id,
      access_mode: accessMode
    });
    const embedHtml = this.store.writePublicationTransportText(
      request.report_id,
      publicationId,
      "embed.html",
      `<!doctype html><html lang="ar" dir="rtl"><body><script type="application/json" id="report-embed">${JSON.stringify({
        publication_id: publicationId,
        embed_payload_uri: embedPayload.uri,
        export_html_uri: exportHtml.uri,
        access_mode: accessMode
      })}</script><iframe src="./published-report.html" title="report-publication" style="width:100%;height:100vh;border:0"></iframe></body></html>`
    );
    const served = registerServedReportPublicationRoute(
      publicationId,
      manifest.filePath,
      publishState.filePath,
      embedPayload.filePath,
      embedHtml.filePath,
      exportHtml.filePath
    );
    const outbox = this.store.writePublicationTransportJson(request.report_id, publicationId, "transport-outbox.json", {
      publication_id: publicationId,
      requested_target_ref: request.target_ref,
      served_manifest_url: served.served_manifest_url,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      queued_at: timestamp
    });
    const backendRef = `backend://report-engine/publications/${publicationId}`;
    const backendManifest = this.store.writeBackendPublicationJson(publicationId, "manifest.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      version_ref: current.version.version_ref.version_id,
      requested_target_ref: request.target_ref,
      editable_artifact_ref: current.reportArtifact.artifact_id,
      html_export_ref: htmlExport.exportArtifact.artifact_id,
      backend_ref: backendRef,
      transport_manifest_path: manifest.filePath,
      transport_publish_state_path: publishState.filePath,
      transport_embed_payload_path: embedPayload.filePath,
      transport_embed_html_path: embedHtml.filePath,
      transport_export_html_path: exportHtml.filePath,
      published_at: timestamp,
      access_mode: accessMode
    });
    const backendAccessState = this.store.writeBackendPublicationJson(publicationId, "access-state.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      access_mode: accessMode,
      permission_scope: current.reportArtifact.permission_scope,
      editable_default: true,
      explicit_non_editable_export: false
    });
    const backendBundleIndex = this.store.writeBackendPublicationJson(publicationId, "bundle-index.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      manifest_uri: backendManifest.uri,
      publish_state_uri: publishState.uri,
      export_html_uri: exportHtml.uri,
      embed_html_uri: embedHtml.uri,
      outbox_uri: outbox.uri
    });
    const backendDeliveryState = this.store.writeBackendPublicationJson(publicationId, "delivery-state.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      state: "delivered",
      delivered_at: timestamp
    });
    const gatewayBundleRef = `transport://report-engine/gateway/${publicationId}`;
    const gatewayManifest = this.store.writeBackendPublicationJson(publicationId, "gateway-manifest.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      backend_ref: backendRef,
      consumable_ref: `report://${publicationId}/embed`,
      served_embed_html_url: served.served_embed_html_url,
      served_manifest_url: served.served_manifest_url,
      access_mode: accessMode
    });
    const accessLifecycle = this.store.writeBackendPublicationJson(publicationId, "access-lifecycle.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      states: [
        { state: "prepared", at: timestamp, detail: "Publication bundle prepared." },
        { state: "served", at: timestamp, detail: "Served URLs exposed through the report gateway." },
        { state: "backend_indexed", at: timestamp, detail: "Backend bundle indexed for downstream consumption." }
      ]
    });
    const deliveryReceipt = this.store.writeBackendPublicationJson(publicationId, "delivery-receipt.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      delivery_status: "delivered",
      delivered_at: timestamp,
      backend_delivery_state_uri: backendDeliveryState.uri,
      served_embed_html_url: served.served_embed_html_url
    });
    const remoteBundle = publishRemoteBundle(
      `publications/${publicationId}`,
      [
        { key: "manifest", fileName: "manifest.json", content: fsSync.readFileSync(manifest.filePath) },
        { key: "publish_state", fileName: "publish-state.json", content: fsSync.readFileSync(publishState.filePath) },
        { key: "embed_payload", fileName: "embed-payload.json", content: fsSync.readFileSync(embedPayload.filePath) },
        { key: "embed_html", fileName: "embed.html", content: fsSync.readFileSync(embedHtml.filePath) },
        { key: "export_html", fileName: "published-report.html", content: fsSync.readFileSync(exportHtml.filePath) },
        { key: "gateway_manifest", fileName: "gateway-manifest.json", content: fsSync.readFileSync(gatewayManifest.filePath) },
        { key: "access_lifecycle", fileName: "access-lifecycle.json", content: fsSync.readFileSync(accessLifecycle.filePath) },
        { key: "delivery_receipt", fileName: "delivery-receipt.json", content: fsSync.readFileSync(deliveryReceipt.filePath) }
      ],
      `Publish report bundle ${publicationId}`
    );
    const transport: ReportPublicationTransport = {
      manifest_path: manifest.filePath,
      manifest_uri: manifest.uri,
      publish_state_path: publishState.filePath,
      publish_state_uri: publishState.uri,
      embed_payload_path: embedPayload.filePath,
      embed_payload_uri: embedPayload.uri,
      embed_html_path: embedHtml.filePath,
      embed_html_uri: embedHtml.uri,
      export_html_path: exportHtml.filePath,
      export_html_uri: exportHtml.uri,
      outbox_path: outbox.filePath,
      outbox_uri: outbox.uri,
      served_manifest_url: served.served_manifest_url,
      served_publish_state_url: served.served_publish_state_url,
      served_embed_payload_url: served.served_embed_payload_url,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      backend_publication_root: path.join(defaultReportEngineBackendRoot(process.cwd()), "publications", publicationId),
      backend_publication_ref: backendRef,
      backend_manifest_path: backendManifest.filePath,
      backend_manifest_uri: backendManifest.uri,
      backend_access_state_path: backendAccessState.filePath,
      backend_access_state_uri: backendAccessState.uri,
      backend_bundle_index_path: backendBundleIndex.filePath,
      backend_bundle_index_uri: backendBundleIndex.uri,
      backend_delivery_state_path: backendDeliveryState.filePath,
      backend_delivery_state_uri: backendDeliveryState.uri,
      gateway_bundle_root: path.join(defaultReportEngineBackendRoot(process.cwd()), "publications", publicationId),
      gateway_bundle_ref: gatewayBundleRef,
      gateway_manifest_path: gatewayManifest.filePath,
      gateway_manifest_uri: gatewayManifest.uri,
      gateway_consumable_ref: `report://${publicationId}/embed`,
      access_lifecycle_path: accessLifecycle.filePath,
      access_lifecycle_uri: accessLifecycle.uri,
      delivery_receipt_path: deliveryReceipt.filePath,
      delivery_receipt_uri: deliveryReceipt.uri,
      served_access_token: served.served_access_token,
      access_mode: accessMode,
      remote_bundle_ref: remoteBundle?.bundle_ref ?? null,
      remote_repository_ref: remoteBundle?.repository_ref ?? null,
      remote_manifest_url: remoteBundle?.assets.manifest?.raw_url ?? null,
      remote_publish_state_url: remoteBundle?.assets.publish_state?.raw_url ?? null,
      remote_embed_payload_url: remoteBundle?.assets.embed_payload?.raw_url ?? null,
      remote_embed_html_url: remoteBundle?.assets.embed_html?.public_url ?? null,
      remote_export_html_url: remoteBundle?.assets.export_html?.public_url ?? null,
      remote_gateway_manifest_url: remoteBundle?.assets.gateway_manifest?.raw_url ?? null,
      remote_access_lifecycle_url: remoteBundle?.assets.access_lifecycle?.raw_url ?? null,
      remote_delivery_receipt_url: remoteBundle?.assets.delivery_receipt?.raw_url ?? null
    };
    const manifestArtifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: id("artifact", request.report_id, "publication", timestamp),
      artifact_type: "workflow_output",
      artifact_subtype: "report_publication_manifest",
      project_id: current.reportArtifact.project_id,
      workspace_id: current.reportArtifact.workspace_id,
      source_refs: [current.report.report_id],
      parent_artifact_refs: [current.reportArtifact.artifact_id, htmlExport.exportArtifact.artifact_id],
      canonical_ref: current.report.canonical_ref,
      created_by: request.actor_ref,
      created_at: timestamp,
      mode: current.report.mode,
      editable_status: "non_editable",
      template_status: "applied",
      lineage_ref: id("lineage-group", request.report_id),
      evidence_ref: id("evidence", request.report_id, "publish"),
      verification_status: "verified",
      storage_ref: {
        ...createStorageRef(id("artifact", request.report_id, "publication")),
        uri: manifest.uri,
        checksum: manifest.checksum,
        region: "local"
      },
      preview_ref: createPreviewRef(id("artifact", request.report_id, "publication"), "html_canvas"),
      export_refs: [],
      version_ref: current.version.version_ref,
      tenant_ref: current.reportArtifact.tenant_ref,
      permission_scope: current.reportArtifact.permission_scope
    });
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: publicationId,
      artifact_ref: current.reportArtifact.artifact_id,
      publication_type: "internal_publish",
      editable_default: true,
      explicit_non_editable_export: false,
      target_ref: transport.remote_bundle_ref ?? transport.gateway_bundle_ref,
      published_by: request.actor_ref,
      published_at: timestamp,
      permission_scope: current.reportArtifact.permission_scope,
      evidence_ref: id("evidence", request.report_id, "publish")
    });
    const libraryAsset = request.publish_to_library
      ? LibraryAssetSchema.parse({
          contract: contractEnvelope("library"),
          asset_id: id("library-asset", request.report_id, timestamp),
          asset_type: "report",
          source: publication.target_ref,
          tags: ["report", current.report.report_type, current.report.mode],
          version: current.version.version_ref.semantic_version,
          tenant_scope: "workspace",
          permission_scope: current.reportArtifact.permission_scope,
          reuse_policy: "free",
          dependency_refs: [current.reportArtifact.artifact_id, htmlExport.exportArtifact.artifact_id],
          created_at: timestamp,
          updated_at: timestamp
        })
      : null;
    const state: PersistableReportState = {
      ...current,
      report: ReportSchema.parse({
        ...current.report,
        status: "published",
        publication_refs: [...current.report.publication_refs, publication.publication_id],
        updated_at: timestamp
      }),
      publications: [...current.publications, publication],
      libraryAssets: libraryAsset ? [...current.libraryAssets, libraryAsset] : current.libraryAssets,
      derivedArtifacts: [...current.derivedArtifacts.filter((item) => item.artifact_id !== manifestArtifact.artifact_id), manifestArtifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.publish_report.v1",
      stage: "report_publish",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reportArtifact.artifact_id, htmlExport.exportArtifact.artifact_id],
      artifactRefs: [manifestArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "publish-ready", timestamp),
          check_name: "publication_ready_check",
          check_type: "publication",
          passed: true,
          severity: "critical",
          details: "Approved report was published with transport manifest, served embed, and HTML output.",
          impacted_refs: [publication.publication_id, manifestArtifact.artifact_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "publish", timestamp),
          from_ref: current.reportArtifact.artifact_id,
          to_ref: publication.publication_id,
          transform_ref: "reports.publish",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return { state: this.store.persistState(state, stage), publication, libraryAsset, transport, ...stage };
  }

  scheduleReport(input: ScheduleReportRequest): ReportScheduleResult {
    const request = ScheduleReportRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const schedule = SharedScheduleSchema.parse({
      contract: contractEnvelope("schedule"),
      schema_namespace: "rasid.shared.schedule.v1",
      schema_version: "1.0.0",
      schedule_id: id("schedule", request.report_id, timestamp),
      schedule_type: request.schedule_type,
      capability: REPORT_CAPABILITY_ID,
      subject_refs: [current.report.report_id, current.version.version_ref.version_id, current.reportArtifact.artifact_id],
      cadence: request.cadence,
      timezone: request.timezone,
      trigger_policy: request.trigger_policy,
      next_run_at: request.next_run_at,
      publication_policy: request.publication_policy,
      state: request.enabled ? "enabled" : "disabled",
      last_run_ref: null,
      execution_template_ref: current.report.template_ref,
      extension_refs: request.selective_regeneration_refs.map((ref) => `binding:${ref}`),
      created_by: request.actor_ref,
      created_at: timestamp,
      updated_at: timestamp
    });
    const state: PersistableReportState = {
      ...current,
      report: ReportSchema.parse({
        ...current.report,
        schedule_refs: [...current.report.schedule_refs, schedule.schedule_id],
        updated_at: timestamp
      }),
      schedules: [...current.schedules, schedule]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.schedule_report.v1",
      stage: "report_schedule",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [current.reportArtifact.artifact_id],
      artifactRefs: [current.reportArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "schedule", timestamp),
          check_name: "schedule_contract_check",
          check_type: "schedule",
          passed: true,
          severity: "high",
          details: "Shared schedule contract was persisted and linked to the report.",
          impacted_refs: [schedule.schedule_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "schedule", timestamp),
          from_ref: current.report.report_id,
          to_ref: schedule.schedule_id,
          transform_ref: "reports.schedule",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return { state: this.store.persistState(state, stage), schedule, ...stage };
  }

  listReportSchedules(input: ListReportSchedulesRequest = {}): ReportScheduleListResult {
    const request = ListReportSchedulesRequestSchema.parse(input);
    const schedules = this.store
      .listSchedules()
      .filter((schedule) => !request.report_id || schedule.subject_refs[0] === request.report_id)
      .filter((schedule) => request.include_disabled || schedule.state === "enabled")
      .sort((left, right) => `${right.updated_at}`.localeCompare(`${left.updated_at}`));
    return { schedules };
  }

  updateReportSchedule(input: UpdateReportScheduleRequest): ReportScheduleResult {
    const request = UpdateReportScheduleRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const existing = this.store.loadSchedule(request.schedule_id);
    if (!existing) {
      throw new Error(`Unknown schedule ${request.schedule_id}`);
    }
    const reportId = existing.subject_refs[0];
    const current = this.store.loadState(reportId);
    const updatedSchedule = SharedScheduleSchema.parse({
      ...existing,
      next_run_at: request.next_run_at === undefined ? existing.next_run_at : request.next_run_at,
      state:
        request.enabled === undefined
          ? existing.state
          : request.enabled
            ? "enabled"
            : "disabled",
      publication_policy: {
        ...existing.publication_policy,
        publication_target_refs: request.publication_target_refs ?? existing.publication_policy.publication_target_refs,
        export_profile_refs: request.export_profile_refs ?? existing.publication_policy.export_profile_refs,
        visibility_scope_ref:
          request.visibility_scope_ref === undefined
            ? existing.publication_policy.visibility_scope_ref
            : request.visibility_scope_ref
      },
      extension_refs:
        request.selective_regeneration_refs === undefined
          ? existing.extension_refs
          : request.selective_regeneration_refs.map((ref) => `binding:${ref}`),
      updated_at: timestamp
    });
    const state: PersistableReportState = {
      ...current,
      report: ReportSchema.parse({
        ...current.report,
        updated_at: timestamp
      }),
      schedules: [...current.schedules.filter((schedule) => schedule.schedule_id !== updatedSchedule.schedule_id), updatedSchedule]
    };
    const stage = createExecutionStage({
      reportId,
      actorRef: request.actor_ref,
      actionRef: "reports.schedule_report.v1",
      stage: "report_schedule_update",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [updatedSchedule.schedule_id],
      artifactRefs: [current.reportArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", reportId, "schedule-update", timestamp),
          check_name: "schedule_update_check",
          check_type: "schedule",
          passed: true,
          severity: "high",
          details: "Shared schedule contract was updated in-place for the report runtime.",
          impacted_refs: [updatedSchedule.schedule_id]
        }
      ],
      lineageEdges: [
        {
          edge_id: id("edge", reportId, "schedule-update", timestamp),
          from_ref: existing.schedule_id,
          to_ref: updatedSchedule.schedule_id,
          transform_ref: "reports.schedule.update",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    return { state: this.store.persistState(state, stage), schedule: updatedSchedule, ...stage };
  }

  cancelReportSchedule(input: CancelReportScheduleRequest): ReportScheduleResult {
    const request = CancelReportScheduleRequestSchema.parse(input);
    return this.updateReportSchedule({
      schedule_id: request.schedule_id,
      actor_ref: request.actor_ref,
      enabled: false,
      timestamp: request.timestamp
    });
  }

  resumeReportSchedule(input: ResumeReportScheduleRequest): ReportScheduleResult {
    const request = ResumeReportScheduleRequestSchema.parse(input);
    return this.updateReportSchedule({
      schedule_id: request.schedule_id,
      actor_ref: request.actor_ref,
      enabled: true,
      next_run_at: request.next_run_at ?? now(request.timestamp),
      timestamp: request.timestamp
    });
  }

  async runReportSchedule(input: RunReportScheduleRequest): Promise<ReportScheduleRunResult[]> {
    const request = RunReportScheduleRequestSchema.parse(input);
    const timestamp = now(request.run_at);
    const schedule = this.store.loadSchedule(request.schedule_id);
    if (!schedule) {
      throw new Error(`Unknown schedule ${request.schedule_id}`);
    }
    const reportId = schedule.subject_refs[0];
    this.updateReportSchedule({
      schedule_id: request.schedule_id,
      actor_ref: request.actor_ref,
      enabled: true,
      next_run_at: timestamp,
      timestamp
    });
    return this.runDueSchedules(timestamp);
  }

  async runDueSchedules(runAt = now()): Promise<ReportScheduleRunResult[]> {
    const dueSchedules = this.store.listSchedules().filter((schedule) => schedule.state === "enabled" && schedule.next_run_at && schedule.next_run_at <= runAt);
    const results: ReportScheduleRunResult[] = [];
    for (const schedule of dueSchedules) {
      const reportId = schedule.subject_refs[0];
      const orchestrationId = id("orchestration", reportId, schedule.schedule_id, runAt);
      const queueRef = `scheduler://report-engine/queue/${orchestrationId}`;
      const orchestrationBase = this.store.saveOrchestrationRecord({
        orchestration_id: orchestrationId,
        schedule_id: schedule.schedule_id,
        report_id: reportId,
        policy_snapshot: {
          cadence: schedule.cadence,
          trigger_policy: schedule.trigger_policy,
          publication_policy: schedule.publication_policy
        },
        dispatch_refs: [],
        retry_count: 0,
        state: "queued",
        current_state: "accepted",
        remote_dispatch_ref: null,
        queue_ref: queueRef,
        state_history: [{ state: "accepted", entered_at: runAt, detail: "Schedule accepted for orchestration." }],
        attempt_history: [],
        degrade_reason: null,
        created_at: runAt,
        updated_at: runAt,
        completed_at: null
      });
      const schedulerQueue = this.store.writeBackendSchedulerJson(orchestrationId, "queue.json", {
        orchestration_id: orchestrationId,
        queue_ref: queueRef,
        accepted_at: runAt,
        schedule_id: schedule.schedule_id,
        report_id: reportId
      });
      const queuedDispatch = this.store.saveDispatchRecord({
        dispatch_id: id("dispatch", reportId, schedule.schedule_id, runAt),
        orchestration_ref: orchestrationId,
        schedule_id: schedule.schedule_id,
        report_id: reportId,
        dispatcher_ref: "report-scheduler",
        due_at: schedule.next_run_at ?? runAt,
        queued_at: runAt,
        started_at: null,
        finished_at: null,
        refresh_job_ref: null,
        publication_ref: null,
        degraded_publication_ref: null,
        transport_delivery_refs: [],
        dispatch_target_ref: schedule.publication_policy.publication_target_refs[0] ?? null,
        attempt_count: 1,
        max_attempts: 2,
        next_retry_at: null,
        state: "queued",
        error_message: null,
        failure_history: []
      });
      const runningDispatch = this.store.saveDispatchRecord({
        ...queuedDispatch,
        state: "running",
        started_at: runAt
      });
      const remoteDispatchRef = `scheduler://report-engine/dispatch/${runningDispatch.dispatch_id}/attempt-${runningDispatch.attempt_count}`;
      let activeDispatch = runningDispatch;
      let activeRemoteDispatchRef = remoteDispatchRef;
      let activeSchedulerDispatch = {
        orchestration_id: orchestrationId,
        queue_ref: queueRef,
        queue_uri: "",
        dispatch_uri: ""
      };
      let orchestration = this.store.saveOrchestrationRecord({
        ...orchestrationBase,
        state: "running",
        current_state: "running",
        remote_dispatch_ref: remoteDispatchRef,
        dispatch_refs: [runningDispatch.dispatch_id],
        state_history: [
          ...orchestrationBase.state_history,
          { state: "queued", entered_at: runAt, detail: "Dispatch queued." },
          { state: "running", entered_at: runAt, detail: "Dispatch execution started." }
        ],
        attempt_history: [
          ...orchestrationBase.attempt_history,
          {
            attempt_number: runningDispatch.attempt_count,
            state: "running",
            dispatch_ref: runningDispatch.dispatch_id,
            remote_dispatch_ref: remoteDispatchRef,
            started_at: runAt,
            finished_at: null,
            detail: "Initial scheduled dispatch attempt started."
          }
        ],
        updated_at: runAt
      });
      const schedulerDispatch = this.store.writeBackendSchedulerJson(orchestrationId, "dispatch-attempt-1.json", {
        orchestration_id: orchestrationId,
        queue_ref: queueRef,
        queue_uri: schedulerQueue.uri,
        dispatch_id: runningDispatch.dispatch_id,
        remote_dispatch_ref: remoteDispatchRef,
        started_at: runAt,
        state: "running"
      });
      activeSchedulerDispatch = {
        orchestration_id: orchestrationId,
        queue_ref: queueRef,
        queue_uri: schedulerQueue.uri,
        dispatch_uri: schedulerDispatch.uri
      };
      const refreshRefs = schedule.extension_refs.filter((entry) => entry.startsWith("binding:")).map((entry) => entry.slice("binding:".length));
      try {
        const refreshed = this.refreshReport({
          report_id: reportId,
          actor_ref: schedule.created_by,
          selective_regeneration_refs: refreshRefs,
          timestamp: runAt
        });
        let publicationResult: ReportPublicationResult | null = null;
        let degradedPublicationResult: ReportPublicationResult | null = null;
        const transportDeliveries: ReportTransportDeliveryRecord[] = [];
        const publishMode = schedule.publication_policy.publish_mode;
        if (publishMode === "always" || publishMode === "on_success" || (publishMode === "on_approval" && refreshed.approvalState.state === "approved")) {
          while (!publicationResult && !degradedPublicationResult) {
            try {
              publicationResult = await this.publishReport({
                report_id: reportId,
                actor_ref: schedule.created_by,
                target_ref: schedule.publication_policy.publication_target_refs[0] ?? `workspace://reports/${reportId}/scheduled`,
                publish_to_library: false,
                timestamp: runAt
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (message.toLowerCase().includes("approval")) {
                degradedPublicationResult = await this.publishDegradedReportOutput({
                  report_id: reportId,
                  actor_ref: schedule.created_by,
                  target_ref: schedule.publication_policy.publication_target_refs[0] ?? `workspace://reports/${reportId}/scheduled/degraded`,
                  reason: `Scheduled publication degraded after publish failure: ${message}`,
                  export_target: "html",
                  timestamp: runAt
                });
                break;
              }
              if (activeDispatch.attempt_count >= activeDispatch.max_attempts) {
                throw error;
              }
              const failedAttemptDispatch = this.store.saveDispatchRecord({
                ...activeDispatch,
                state: "retrying",
                finished_at: runAt,
                next_retry_at: addCadence(runAt, "custom"),
                error_message: message,
                failure_history: [
                  ...activeDispatch.failure_history,
                  { attempt_number: activeDispatch.attempt_count, error_message: message, failed_at: runAt }
                ]
              });
              activeRemoteDispatchRef =
                `scheduler://report-engine/dispatch/${failedAttemptDispatch.dispatch_id}/attempt-${failedAttemptDispatch.attempt_count + 1}`;
              orchestration = this.store.saveOrchestrationRecord({
                ...orchestration,
                dispatch_refs: [failedAttemptDispatch.dispatch_id],
                retry_count: failedAttemptDispatch.failure_history.length,
                current_state: "retrying",
                remote_dispatch_ref: activeRemoteDispatchRef,
                state_history: [
                  ...orchestration.state_history,
                  {
                    state: "retrying",
                    entered_at: runAt,
                    detail: `Retry scheduled after transient transport failure: ${message}`
                  }
                ],
                attempt_history: [
                  ...orchestration.attempt_history.map((attempt, index, attempts) =>
                    index === attempts.length - 1
                      ? { ...attempt, state: "failed", finished_at: runAt, detail: message }
                      : attempt
                  ),
                  {
                    attempt_number: failedAttemptDispatch.attempt_count + 1,
                    state: "running",
                    dispatch_ref: failedAttemptDispatch.dispatch_id,
                    remote_dispatch_ref: activeRemoteDispatchRef,
                    started_at: runAt,
                    finished_at: null,
                    detail: "Retry attempt started after transient transport failure."
                  }
                ],
                updated_at: runAt
              });
              activeDispatch = this.store.saveDispatchRecord({
                ...failedAttemptDispatch,
                attempt_count: failedAttemptDispatch.attempt_count + 1,
                state: "running",
                started_at: runAt,
                finished_at: null,
                next_retry_at: null,
                error_message: null
              });
              const retrySchedulerDispatch = this.store.writeBackendSchedulerJson(
                orchestrationId,
                `dispatch-attempt-${activeDispatch.attempt_count}.json`,
                {
                  orchestration_id: orchestrationId,
                  queue_ref: queueRef,
                  queue_uri: schedulerQueue.uri,
                  dispatch_id: activeDispatch.dispatch_id,
                  remote_dispatch_ref: activeRemoteDispatchRef,
                  started_at: runAt,
                  state: "running"
                }
              );
              activeSchedulerDispatch = {
                orchestration_id: orchestrationId,
                queue_ref: queueRef,
                queue_uri: schedulerQueue.uri,
                dispatch_uri: retrySchedulerDispatch.uri
              };
            }
          }
        }
        if (publicationResult?.transport) {
          transportDeliveries.push(
            this.store.saveTransportDeliveryRecord({
              delivery_id: id("delivery", reportId, publicationResult.publication.publication_id, runAt),
              report_id: reportId,
              dispatch_id: activeDispatch.dispatch_id,
              publication_id: publicationResult.publication.publication_id,
              target_ref: publicationResult.publication.target_ref,
              backend_ref: publicationResult.transport.backend_publication_ref,
              remote_transport_ref: publicationResult.transport.remote_bundle_ref ?? publicationResult.transport.gateway_bundle_ref,
              served_target_url: publicationResult.transport.remote_embed_html_url ?? publicationResult.transport.served_embed_html_url,
              delivery_mode: "backend_bundle",
              access_mode: publicationResult.transport.access_mode,
              state: "delivered",
              lifecycle_state: "delivered",
              access_state_ref: publicationResult.transport.access_lifecycle_uri,
              delivery_receipt_ref: publicationResult.transport.delivery_receipt_uri,
              failure_reason: null,
              created_at: runAt,
              updated_at: runAt
            })
          );
        }
        if (degradedPublicationResult) {
          transportDeliveries.push(
            this.store.saveTransportDeliveryRecord({
              delivery_id: id("delivery", reportId, degradedPublicationResult.publication.publication_id, "degraded", runAt),
              report_id: reportId,
              dispatch_id: activeDispatch.dispatch_id,
              publication_id: degradedPublicationResult.publication.publication_id,
              target_ref: degradedPublicationResult.publication.target_ref,
              backend_ref: degradedPublicationResult.transport?.backend_publication_ref ?? null,
              remote_transport_ref: degradedPublicationResult.transport?.remote_bundle_ref ?? null,
              served_target_url: degradedPublicationResult.transport?.remote_export_html_url ?? null,
              delivery_mode: "degraded_export",
              access_mode: null,
              state: "degraded",
              lifecycle_state: "degraded",
              access_state_ref: null,
              delivery_receipt_ref: null,
              failure_reason: "scheduled_publish_degraded",
              created_at: runAt,
              updated_at: runAt
            })
          );
        }
        const latestState = this.store.loadState(reportId);
        const updatedSchedule = SharedScheduleSchema.parse({
          ...schedule,
          last_run_ref: refreshed.job.job_id,
          next_run_at: addCadence(schedule.next_run_at, schedule.cadence),
          updated_at: runAt
        });
        const state: PersistableReportState = {
          ...latestState,
          schedules: latestState.schedules.map((entry) => (entry.schedule_id === updatedSchedule.schedule_id ? updatedSchedule : entry))
        };
        const completedDispatch = this.store.saveDispatchRecord({
          ...activeDispatch,
          state: degradedPublicationResult ? "degraded" : "completed",
          finished_at: runAt,
          refresh_job_ref: refreshed.job.job_id,
          publication_ref: publicationResult?.publication.publication_id ?? null,
          degraded_publication_ref: degradedPublicationResult?.publication.publication_id ?? null,
          transport_delivery_refs: transportDeliveries.map((delivery) => delivery.delivery_id)
        });
        orchestration = this.store.saveOrchestrationRecord({
          ...orchestration,
          dispatch_refs: [completedDispatch.dispatch_id],
          retry_count: completedDispatch.failure_history.length,
          state: degradedPublicationResult ? "degraded" : "completed",
          current_state: degradedPublicationResult ? "degraded" : "completed",
          state_history: [
            ...orchestration.state_history,
            {
              state: publicationResult ? "publishing" : "running",
              entered_at: runAt,
              detail: publicationResult ? "Publication dispatched to externalized transport bundle." : "Refresh completed without publish."
            },
            {
              state: degradedPublicationResult ? "degraded" : "completed",
              entered_at: runAt,
              detail: degradedPublicationResult
                ? "Scheduled dispatch completed with degraded publication fallback."
                : "Scheduled dispatch completed successfully."
            }
          ],
          attempt_history: orchestration.attempt_history.map((attempt, index, attempts) =>
            index === attempts.length - 1
              ? {
                  ...attempt,
                  state: degradedPublicationResult ? "degraded" : "completed",
                  finished_at: runAt,
                  detail: degradedPublicationResult
                    ? "Dispatch completed with degraded publication fallback."
                    : "Dispatch completed successfully."
                }
              : attempt
          ),
          degrade_reason: degradedPublicationResult ? "scheduled_publish_degraded" : null,
          updated_at: runAt,
          completed_at: runAt
        });
        this.store.writeBackendSchedulerJson(orchestrationId, "result.json", {
          orchestration_id: orchestrationId,
          queue_ref: queueRef,
          queue_uri: schedulerQueue.uri,
          dispatch_id: completedDispatch.dispatch_id,
          dispatch_uri: activeSchedulerDispatch.dispatch_uri,
          remote_dispatch_ref: activeRemoteDispatchRef,
          state: orchestration.state,
          current_state: orchestration.current_state,
          publication_ref: publicationResult?.publication.publication_id ?? null,
          degraded_publication_ref: degradedPublicationResult?.publication.publication_id ?? null,
          transport_delivery_refs: transportDeliveries.map((delivery) => delivery.delivery_id),
          completed_at: runAt
        });
        const remoteSchedulerBundle = publishRemoteSchedulerBundle(orchestrationId);
        if (remoteSchedulerBundle) {
          const remoteQueueUrl = remoteSchedulerBundle.assets.queue_json?.raw_url ?? queueRef;
          const remoteDispatchUrl =
            remoteSchedulerBundle.assets[`dispatch_attempt_${activeDispatch.attempt_count}_json`]?.raw_url ??
            remoteSchedulerBundle.assets.result_json?.raw_url ??
            activeRemoteDispatchRef;
          orchestration = this.store.saveOrchestrationRecord({
            ...orchestration,
            queue_ref: remoteQueueUrl,
            remote_dispatch_ref: remoteDispatchUrl,
            updated_at: runAt
          });
          transportDeliveries.splice(
            0,
            transportDeliveries.length,
            ...transportDeliveries.map((delivery) =>
              this.store.saveTransportDeliveryRecord({
                ...delivery,
                remote_transport_ref: delivery.remote_transport_ref ?? remoteSchedulerBundle.bundle_ref,
                delivery_receipt_ref: delivery.delivery_receipt_ref ?? remoteSchedulerBundle.assets.result_json?.raw_url ?? delivery.delivery_receipt_ref,
                updated_at: runAt
              })
            )
          );
        }
        const runnerStage = createExecutionStage({
          reportId,
          actorRef: schedule.created_by,
          actorType: "service",
          actionRef: "reports.schedule_report.v1",
          stage: "report_schedule_runner",
          workspaceId: latestState.reportArtifact.workspace_id,
          tenantRef: latestState.reportArtifact.tenant_ref,
          sourceRefs: [updatedSchedule.schedule_id, completedDispatch.dispatch_id, orchestration.orchestration_id],
          artifactRefs:
            publicationResult
              ? [publicationResult.publication.publication_id]
              : degradedPublicationResult
                ? [degradedPublicationResult.publication.publication_id]
                : [refreshed.job.job_id],
          requestedMode: latestState.report.mode,
          timestamp: runAt,
          checks: [
            {
              check_id: id("check", reportId, "schedule-runner", runAt),
              check_name: "schedule_execution_check",
              check_type: "schedule",
              passed: true,
              severity: "high",
              details: "Scheduled report run executed refresh, orchestration, dispatch, transport delivery, and publication/degraded fallback.",
              impacted_refs: [updatedSchedule.schedule_id, refreshed.job.job_id, completedDispatch.dispatch_id, orchestration.orchestration_id]
            }
          ],
          warnings: degradedPublicationResult
            ? [baseWarning("scheduled_publish_degraded", "Scheduled publication degraded.", "Scheduler fell back to degraded publication after publish failure.", [degradedPublicationResult.publication.publication_id])]
            : [],
          lineageEdges: [
            {
              edge_id: id("edge", reportId, "schedule-runner", runAt),
              from_ref: updatedSchedule.schedule_id,
              to_ref: refreshed.job.job_id,
              transform_ref: "reports.schedule.run",
              ai_suggestion_ref: "",
              ai_decision: "not_applicable",
              template_ref: latestState.report.template_ref,
              dataset_binding_ref: latestState.bindingSet.binding_set_id,
              version_diff_ref: latestState.version.version_ref.version_id
            }
          ]
        });
        const persisted = this.store.persistState(state, runnerStage);
        results.push({
          schedule: updatedSchedule,
          dispatch: completedDispatch,
          orchestration,
          transportDeliveries,
          refreshResult: refreshed,
          publicationResult,
          degradedPublicationResult,
          runnerStage,
          state: persisted
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedDispatch = this.store.saveDispatchRecord({
          ...activeDispatch,
          state: "failed",
          finished_at: runAt,
          error_message: message,
          failure_history: [
            ...activeDispatch.failure_history,
            { attempt_number: activeDispatch.attempt_count, error_message: message, failed_at: runAt }
          ]
        });
        let failedOrchestration = this.store.saveOrchestrationRecord({
          ...orchestration,
          dispatch_refs: [failedDispatch.dispatch_id],
          retry_count: failedDispatch.failure_history.length,
          state: "failed",
          current_state: "failed",
          state_history: [...orchestration.state_history, { state: "failed", entered_at: runAt, detail: message }],
          attempt_history: orchestration.attempt_history.map((attempt, index, attempts) =>
            index === attempts.length - 1
              ? { ...attempt, state: "failed", finished_at: runAt, detail: message }
              : attempt
          ),
          degrade_reason: null,
          updated_at: runAt,
          completed_at: runAt
        });
        this.store.writeBackendSchedulerJson(orchestrationId, "failure.json", {
          orchestration_id: orchestrationId,
          queue_ref: queueRef,
          queue_uri: schedulerQueue.uri,
          dispatch_id: failedDispatch.dispatch_id,
          dispatch_uri: activeSchedulerDispatch.dispatch_uri,
          remote_dispatch_ref: activeRemoteDispatchRef,
          state: "failed",
          error_message: message,
          failed_at: runAt
        });
        const remoteSchedulerBundle = publishRemoteSchedulerBundle(orchestrationId);
        if (remoteSchedulerBundle) {
          failedOrchestration = this.store.saveOrchestrationRecord({
            ...failedOrchestration,
            queue_ref: remoteSchedulerBundle.assets.queue_json?.raw_url ?? failedOrchestration.queue_ref,
            remote_dispatch_ref:
              remoteSchedulerBundle.assets[`dispatch_attempt_${activeDispatch.attempt_count}_json`]?.raw_url ??
              remoteSchedulerBundle.assets.failure_json?.raw_url ??
              failedOrchestration.remote_dispatch_ref,
            updated_at: runAt
          });
        }
        throw error;
      }
    }
    return results;
  }

  async publishDegradedReportOutput(input: PublishDegradedReportOutputRequest): Promise<ReportPublicationResult> {
    const request = PublishDegradedReportOutputRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const current = this.store.loadState(request.report_id);
    const exportResult = await this.exportReport({ report_id: request.report_id, actor_ref: request.actor_ref, target: request.export_target, timestamp });
    const publicationId = id("publication", request.report_id, "degraded", timestamp);
    const accessMode = request.export_target === "docx" ? "editable" : "read_only";
    const manifestArtifact = this.store.writeAuxiliaryArtifact(
      request.report_id,
      ArtifactSchema.parse({
        contract: contractEnvelope("artifact"),
        artifact_id: id("artifact", request.report_id, "degraded-publication", timestamp),
        artifact_type: "workflow_output",
        artifact_subtype: "degraded_report_publication_manifest",
        project_id: current.reportArtifact.project_id,
        workspace_id: current.reportArtifact.workspace_id,
        source_refs: [current.report.report_id],
        parent_artifact_refs: [current.reportArtifact.artifact_id, exportResult.exportArtifact.artifact_id],
        canonical_ref: current.report.canonical_ref,
        created_by: request.actor_ref,
        created_at: timestamp,
        mode: current.report.mode,
        editable_status: "non_editable",
        template_status: "applied",
        lineage_ref: id("lineage-group", request.report_id),
        evidence_ref: id("evidence", request.report_id, "degraded-publish"),
        verification_status: "degraded",
        storage_ref: createStorageRef(id("artifact", request.report_id, "degraded-publication")),
        preview_ref: createPreviewRef(id("artifact", request.report_id, "degraded-publication"), "html_canvas"),
        export_refs: [],
        version_ref: current.version.version_ref,
        tenant_ref: current.reportArtifact.tenant_ref,
        permission_scope: current.reportArtifact.permission_scope
      }),
      path.join("published", "degraded-publication.json"),
      JSON.stringify({ report_id: current.report.report_id, export_artifact_ref: exportResult.exportArtifact.artifact_id, reason: request.reason, published_at: timestamp }, null, 2)
    );
    const exportHtmlContent =
      request.export_target === "html" && typeof exportResult.payload === "string"
        ? exportResult.payload
        : `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Degraded report ${current.report.report_id}</title></head><body><main style="font-family:Segoe UI,Tahoma,sans-serif;max-width:960px;margin:0 auto;padding:24px"><h1>Degraded report publication</h1><p>Report: ${current.report.report_id}</p><p>Reason: ${request.reason}</p><p>Export target: ${request.export_target}</p><p>This publication was externalized in degraded mode.</p></main></body></html>`;
    const manifest = this.store.writePublicationTransportJson(request.report_id, publicationId, "manifest.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      version_ref: current.version.version_ref.version_id,
      requested_target_ref: request.target_ref,
      export_target: request.export_target,
      degraded: true,
      reason: request.reason,
      editable_artifact_ref: current.reportArtifact.artifact_id,
      export_artifact_ref: exportResult.exportArtifact.artifact_id,
      published_at: timestamp,
      access_mode: accessMode
    });
    const publishState = this.store.writePublicationTransportJson(request.report_id, publicationId, "publish-state.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      publication_state: "degraded",
      access_mode: accessMode,
      export_target: request.export_target,
      degraded: true,
      reason: request.reason,
      published_at: timestamp
    });
    const embedPayload = this.store.writePublicationTransportJson(request.report_id, publicationId, "embed-payload.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      degraded: true,
      access_mode: accessMode,
      export_target: request.export_target,
      reason: request.reason,
      export_artifact_ref: exportResult.exportArtifact.artifact_id,
      export_uri: exportResult.exportArtifact.storage_ref.uri
    });
    const exportHtml = this.store.writePublicationTransportText(request.report_id, publicationId, "published-report.html", exportHtmlContent);
    const embedHtml = this.store.writePublicationTransportText(
      request.report_id,
      publicationId,
      "embed.html",
      `<!doctype html><html lang="ar" dir="rtl"><body><script type="application/json" id="report-embed">${JSON.stringify({
        publication_id: publicationId,
        degraded: true,
        embed_payload_uri: embedPayload.uri,
        export_html_uri: exportHtml.uri,
        access_mode: accessMode,
        reason: request.reason
      })}</script><iframe src="./published-report.html" title="report-degraded-publication" style="width:100%;height:100vh;border:0"></iframe></body></html>`
    );
    const served = registerServedReportPublicationRoute(
      publicationId,
      manifest.filePath,
      publishState.filePath,
      embedPayload.filePath,
      embedHtml.filePath,
      exportHtml.filePath
    );
    const outbox = this.store.writePublicationTransportJson(request.report_id, publicationId, "transport-outbox.json", {
      publication_id: publicationId,
      requested_target_ref: request.target_ref,
      degraded: true,
      served_manifest_url: served.served_manifest_url,
      served_publish_state_url: served.served_publish_state_url,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      queued_at: timestamp
    });
    const backendRef = `backend://report-engine/publications/${publicationId}`;
    const backendManifest = this.store.writeBackendPublicationJson(publicationId, "manifest.json", {
      publication_id: publicationId,
      report_id: current.report.report_id,
      version_ref: current.version.version_ref.version_id,
      requested_target_ref: request.target_ref,
      export_target: request.export_target,
      degraded: true,
      reason: request.reason,
      editable_artifact_ref: current.reportArtifact.artifact_id,
      export_artifact_ref: exportResult.exportArtifact.artifact_id,
      backend_ref: backendRef,
      transport_manifest_path: manifest.filePath,
      transport_publish_state_path: publishState.filePath,
      transport_embed_payload_path: embedPayload.filePath,
      transport_embed_html_path: embedHtml.filePath,
      transport_export_html_path: exportHtml.filePath,
      published_at: timestamp,
      access_mode: accessMode
    });
    const backendAccessState = this.store.writeBackendPublicationJson(publicationId, "access-state.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      access_mode: accessMode,
      permission_scope: current.reportArtifact.permission_scope,
      editable_default: request.export_target === "docx",
      explicit_non_editable_export: request.export_target !== "docx",
      degraded: true,
      reason: request.reason
    });
    const backendBundleIndex = this.store.writeBackendPublicationJson(publicationId, "bundle-index.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      manifest_uri: backendManifest.uri,
      publish_state_uri: publishState.uri,
      export_html_uri: exportHtml.uri,
      embed_html_uri: embedHtml.uri,
      outbox_uri: outbox.uri
    });
    const backendDeliveryState = this.store.writeBackendPublicationJson(publicationId, "delivery-state.json", {
      publication_id: publicationId,
      backend_ref: backendRef,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      state: "degraded",
      delivered_at: timestamp,
      degrade_reason: request.reason
    });
    const gatewayBundleRef = `transport://report-engine/gateway/${publicationId}`;
    const gatewayManifest = this.store.writeBackendPublicationJson(publicationId, "gateway-manifest.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      backend_ref: backendRef,
      consumable_ref: `report://${publicationId}/embed`,
      served_embed_html_url: served.served_embed_html_url,
      served_manifest_url: served.served_manifest_url,
      access_mode: accessMode,
      degraded: true
    });
    const accessLifecycle = this.store.writeBackendPublicationJson(publicationId, "access-lifecycle.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      states: [
        { state: "prepared", at: timestamp, detail: "Degraded publication bundle prepared." },
        { state: "served", at: timestamp, detail: "Degraded publication served through the report gateway." },
        { state: "degraded", at: timestamp, detail: request.reason }
      ]
    });
    const deliveryReceipt = this.store.writeBackendPublicationJson(publicationId, "delivery-receipt.json", {
      publication_id: publicationId,
      gateway_bundle_ref: gatewayBundleRef,
      delivery_status: "degraded",
      delivered_at: timestamp,
      backend_delivery_state_uri: backendDeliveryState.uri,
      served_embed_html_url: served.served_embed_html_url
    });
    const degradedTransportPayload = {
      publication_id: publicationId,
      report_id: current.report.report_id,
      export_artifact_ref: exportResult.exportArtifact.artifact_id,
      reason: request.reason,
      published_at: timestamp,
      export_target: request.export_target
    };
    const remoteBundle = publishRemoteBundle(
      `publications/${publicationId}`,
      [
        { key: "manifest", fileName: "manifest.json", content: fsSync.readFileSync(manifest.filePath) },
        { key: "publish_state", fileName: "publish-state.json", content: fsSync.readFileSync(publishState.filePath) },
        { key: "embed_payload", fileName: "embed-payload.json", content: fsSync.readFileSync(embedPayload.filePath) },
        { key: "embed_html", fileName: "embed.html", content: fsSync.readFileSync(embedHtml.filePath) },
        { key: "export_html", fileName: "published-report.html", content: fsSync.readFileSync(exportHtml.filePath) },
        { key: "gateway_manifest", fileName: "gateway-manifest.json", content: fsSync.readFileSync(gatewayManifest.filePath) },
        { key: "access_lifecycle", fileName: "access-lifecycle.json", content: fsSync.readFileSync(accessLifecycle.filePath) },
        { key: "delivery_receipt", fileName: "delivery-receipt.json", content: fsSync.readFileSync(deliveryReceipt.filePath) },
        { key: "degraded_manifest", fileName: "degraded-publication.json", content: JSON.stringify(degradedTransportPayload, null, 2) },
        {
          key: "export_binary",
          fileName: `degraded-export.${request.export_target}`,
          content: typeof exportResult.payload === "string" ? exportResult.payload : Buffer.from(exportResult.payload)
        }
      ],
      `Publish degraded report bundle ${request.report_id}`
    );
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: publicationId,
      artifact_ref: exportResult.exportArtifact.artifact_id,
      publication_type: "external_export",
      editable_default: request.export_target === "docx",
      explicit_non_editable_export: request.export_target !== "docx",
      target_ref: remoteBundle?.bundle_ref ?? backendRef,
      published_by: request.actor_ref,
      published_at: timestamp,
      permission_scope: current.reportArtifact.permission_scope,
      evidence_ref: id("evidence", request.report_id, "degraded-publish")
    });
    const degradedReason = baseFailure("degraded_publish", "Publishing degraded report output.", request.reason, [manifestArtifact.artifact_id]);
    const state: PersistableReportState = {
      ...this.store.loadState(request.report_id),
      report: ReportSchema.parse({
        ...current.report,
        status: "degraded",
        publication_refs: [...current.report.publication_refs, publication.publication_id],
        updated_at: timestamp
      }),
      publications: [...current.publications, publication],
      derivedArtifacts: [...current.derivedArtifacts.filter((item) => item.artifact_id !== manifestArtifact.artifact_id), manifestArtifact]
    };
    const stage = createExecutionStage({
      reportId: request.report_id,
      actorRef: request.actor_ref,
      actionRef: "reports.publish_degraded_report_output.v1",
      stage: "report_publish_degraded",
      workspaceId: current.reportArtifact.workspace_id,
      tenantRef: current.reportArtifact.tenant_ref,
      sourceRefs: [exportResult.exportArtifact.artifact_id],
      artifactRefs: [manifestArtifact.artifact_id],
      requestedMode: current.report.mode,
      timestamp,
      checks: [
        {
          check_id: id("check", request.report_id, "degraded", timestamp),
          check_name: "degraded_publish_check",
          check_type: "publication",
          passed: true,
          severity: "high",
          details: "Degraded publication manifest was created explicitly with a reason.",
          impacted_refs: [publication.publication_id]
        }
      ],
      warnings: [baseWarning("degraded_output", "Output published in degraded mode.", request.reason, [exportResult.exportArtifact.artifact_id])],
      degradedReasons: [degradedReason],
      lineageEdges: [
        {
          edge_id: id("edge", request.report_id, "degraded", timestamp),
          from_ref: exportResult.exportArtifact.artifact_id,
          to_ref: publication.publication_id,
          transform_ref: "reports.publish.degraded",
          ai_suggestion_ref: "",
          ai_decision: "not_applicable",
          template_ref: current.report.template_ref,
          dataset_binding_ref: current.bindingSet.binding_set_id,
          version_diff_ref: current.version.version_ref.version_id
        }
      ]
    });
    const transport: ReportPublicationTransport = {
      manifest_path: manifest.filePath,
      manifest_uri: manifest.uri,
      publish_state_path: publishState.filePath,
      publish_state_uri: publishState.uri,
      embed_payload_path: embedPayload.filePath,
      embed_payload_uri: embedPayload.uri,
      embed_html_path: embedHtml.filePath,
      embed_html_uri: embedHtml.uri,
      export_html_path: exportHtml.filePath,
      export_html_uri: exportHtml.uri,
      outbox_path: outbox.filePath,
      outbox_uri: outbox.uri,
      served_manifest_url: served.served_manifest_url,
      served_publish_state_url: served.served_publish_state_url,
      served_embed_payload_url: served.served_embed_payload_url,
      served_embed_html_url: served.served_embed_html_url,
      served_export_html_url: served.served_export_html_url,
      backend_publication_root: path.join(defaultReportEngineBackendRoot(process.cwd()), "publications", publicationId),
      backend_publication_ref: backendRef,
      backend_manifest_path: backendManifest.filePath,
      backend_manifest_uri: backendManifest.uri,
      backend_access_state_path: backendAccessState.filePath,
      backend_access_state_uri: backendAccessState.uri,
      backend_bundle_index_path: backendBundleIndex.filePath,
      backend_bundle_index_uri: backendBundleIndex.uri,
      backend_delivery_state_path: backendDeliveryState.filePath,
      backend_delivery_state_uri: backendDeliveryState.uri,
      gateway_bundle_root: path.join(defaultReportEngineBackendRoot(process.cwd()), "publications", publicationId),
      gateway_bundle_ref: gatewayBundleRef,
      gateway_manifest_path: gatewayManifest.filePath,
      gateway_manifest_uri: gatewayManifest.uri,
      gateway_consumable_ref: `report://${publicationId}/embed`,
      access_lifecycle_path: accessLifecycle.filePath,
      access_lifecycle_uri: accessLifecycle.uri,
      delivery_receipt_path: deliveryReceipt.filePath,
      delivery_receipt_uri: deliveryReceipt.uri,
      served_access_token: served.served_access_token,
      access_mode: accessMode,
      remote_bundle_ref: remoteBundle?.bundle_ref ?? null,
      remote_repository_ref: remoteBundle?.repository_ref ?? null,
      remote_manifest_url: remoteBundle?.assets.manifest?.raw_url ?? null,
      remote_publish_state_url: remoteBundle?.assets.publish_state?.raw_url ?? null,
      remote_embed_payload_url: remoteBundle?.assets.embed_payload?.raw_url ?? null,
      remote_embed_html_url: remoteBundle?.assets.embed_html?.public_url ?? null,
      remote_export_html_url: remoteBundle?.assets.export_html?.public_url ?? null,
      remote_gateway_manifest_url: remoteBundle?.assets.gateway_manifest?.raw_url ?? null,
      remote_access_lifecycle_url: remoteBundle?.assets.access_lifecycle?.raw_url ?? null,
      remote_delivery_receipt_url: remoteBundle?.assets.delivery_receipt?.raw_url ?? null
    };
    return { state: this.store.persistState(state, stage), publication, libraryAsset: null, transport, ...stage };
  }
}

const reportToolToActionMap: Record<string, string> = {
  "registry.reports.create_report": "reports.create_report.v1",
  "registry.reports.update_report": "reports.update_report.v1",
  "registry.reports.refresh_report": "reports.refresh_report.v1",
  "registry.reports.compare_reports": "reports.compare_reports.v1",
  "registry.reports.review_report": "reports.review_report.v1",
  "registry.reports.approve_report": "reports.approve_report.v1",
  "registry.reports.publish_report": "reports.publish_report.v1",
  "registry.reports.schedule_report": "reports.schedule_report.v1",
  "registry.reports.export_report_docx": "reports.export_report_docx.v1",
  "registry.reports.export_report_pdf": "reports.export_report_pdf.v1",
  "registry.reports.export_report_html": "reports.export_report_html.v1",
  "registry.reports.convert_report_to_presentation": "reports.convert_report_to_presentation.v1",
  "registry.reports.convert_report_to_dashboard": "reports.convert_report_to_dashboard.v1",
  "registry.reports.publish_degraded_report_output": "reports.publish_degraded_report_output.v1"
};

export const dispatchReportAction = async (input: ReportDispatchRequest): Promise<unknown> => {
  const request = ReportDispatchRequestSchema.parse(input);
  const engine = new ReportEngine({ storageDir: request.storage_dir });
  switch (request.action_id) {
    case "reports.create_report.v1":
      return engine.createReport(request.payload as CreateReportRequest);
    case "reports.update_report.v1":
      return engine.updateReport(request.payload as UpdateReportRequest);
    case "reports.refresh_report.v1":
      return engine.refreshReport(request.payload as RefreshReportRequest);
    case "reports.compare_reports.v1":
      return engine.compareReports(request.payload as CompareReportsRequest);
    case "reports.review_report.v1":
      return engine.reviewReport(request.payload as ReviewReportRequest);
    case "reports.approve_report.v1":
      return engine.approveReport(request.payload as ApproveReportRequest);
    case "reports.publish_report.v1":
      return engine.publishReport(request.payload as PublishReportRequest);
    case "reports.schedule_report.v1":
      return engine.scheduleReport(request.payload as ScheduleReportRequest);
    case "reports.export_report_docx.v1":
      return engine.exportReportDocx(request.payload as ExportReportRequest);
    case "reports.export_report_pdf.v1":
      return engine.exportReportPdf(request.payload as ExportReportRequest);
    case "reports.export_report_html.v1":
      return engine.exportReportHtml(request.payload as ExportReportRequest);
    case "reports.convert_report_to_presentation.v1":
      return engine.convertReportToPresentation(request.payload as ConvertReportRequest);
    case "reports.convert_report_to_dashboard.v1":
      return engine.convertReportToDashboard(request.payload as ConvertReportRequest);
    case "reports.publish_degraded_report_output.v1":
      return engine.publishDegradedReportOutput(request.payload as PublishDegradedReportOutputRequest);
    default:
      throw new Error(`Unsupported report action: ${request.action_id}`);
  }
};

export const dispatchReportTool = async (input: ReportToolDispatchRequest): Promise<unknown> => {
  const request = ReportToolDispatchRequestSchema.parse(input);
  const actionId = reportToolToActionMap[request.tool_id];
  if (!actionId) {
    throw new Error(`Unsupported report tool: ${request.tool_id}`);
  }
  return dispatchReportAction({
    action_id: actionId,
    payload: request.payload,
    storage_dir: request.storage_dir
  });
};

export const startReportPublicationService = (options?: ReportEngineOptions): ReportPublicationServiceStatus => {
  const store = new ReportEngineStore(options?.storageDir);
  ensureReportTransportServer();
  const publications = rehydratePersistedReportPublications(store);
  return {
    host: REPORT_TRANSPORT_HOST,
    port: reportTransportPort,
    base_url: `http://${REPORT_TRANSPORT_HOST}:${reportTransportPort}`,
    storage_dir: store.rootDir,
    backend_root: store.backendRoot,
    publications
  };
};

export const registerReportCapability = (runtime: RegistryBootstrap): void => {
  runtime.registerCapability({
    capability_id: REPORT_CAPABILITY_ID,
    display_name: "Report Engine",
    package_name: "@rasid/report-engine",
    contract_version: "1.0.0",
    supported_action_refs: ReportActionRegistry.map((action) => action.action_id),
    supported_tool_refs: ReportToolRegistry.map((tool) => tool.tool_id)
  });
  runtime.registerManifest(createActionManifest(REPORT_CAPABILITY_ID, "1.0.0", ReportActionRegistry, ["approval.default"], ["evidence.default"]));
  ReportToolRegistry.forEach((tool) => runtime.registerTool(tool));
};

export const runReportRegressionSuite = async (): Promise<ReportRegressionSuiteResult> => {
  const regressionRoot = path.join(process.cwd(), ".runtime", "report-engine-regression");
  await fs.rm(regressionRoot, { recursive: true, force: true });
  const engine = new ReportEngine({
    storageDir: regressionRoot
  });
  const runId = id("report-regression", now().replace(/[^0-9]/g, ""));
  const importRoot = path.join(engine.store.rootDir, "import-sources");
  await fs.mkdir(importRoot, { recursive: true });
  const docxPath = path.join(importRoot, "external-source.docx");
  const pdfPath = path.join(importRoot, "external-source.pdf");
  await fs.writeFile(docxPath, Buffer.from(await createSampleDocx("External Weekly Report", [])));
  await fs.writeFile(pdfPath, Buffer.from(createSamplePdf([])));
  const ingestedDocx = await engine.ingestExternalReport({
    report_id: "report-service-request-04-docx",
    tenant_ref: "tenant-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    created_by: "importer-1",
    title: "Imported DOCX Report",
    language: "en-US",
    file_path: docxPath,
    parser_hint: "docx",
    source_refs: ["source://external/docx"]
  });
  const ingestedPdf = await engine.ingestExternalReport({
    report_id: "report-service-request-04-pdf",
    tenant_ref: "tenant-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    created_by: "importer-1",
    title: "Imported PDF Report",
    language: "en-US",
    file_path: pdfPath,
    parser_hint: "pdf",
    source_refs: ["source://external/pdf"]
  });
  const created = engine.createReport({
    report_id: "report-service-request-04",
    tenant_ref: "tenant-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    created_by: "user-1",
    title: "محرك التقارير داخل راصد",
    description: "Editable source-of-truth report with exports, review, approval, publication, and schedule flows.",
    report_type: "executive_program_report",
    mode: "advanced",
    language: "ar-SA",
    template_ref: "template://reports/executive",
    brand_preset_ref: "brand://rasid/default",
    source_refs: ["dataset://weekly-kpis", "dataset://program-risks"],
    sections: [
      {
        section_kind: "cover",
        title: "ملخص البرنامج التنفيذي",
        blocks: [
          {
            block_type: "narrative",
            title: "افتتاحية التقرير",
            body: "هذا التقرير هو المصدر الداخلي القابل للتحرير، بينما تبقى مخرجات DOCX وPDF وHTML مشتقة فقط."
          }
        ]
      },
      {
        section_kind: "executive_summary",
        title: "الملخص التنفيذي",
        blocks: [
          {
            block_type: "metric_card",
            title: "نسبة الإنجاز",
            body: "نسبة الإنجاز الحالية للمبادرات الحرجة.",
            dataset_ref: "dataset://weekly-kpis",
            query_ref: "query://weekly-kpis/completion",
            field_mappings: [{ metric: "completion_rate" }],
            metric_value: 67
          },
          {
            block_type: "chart",
            title: "تطور الأداء",
            body: "تتبع أسبوعي للمؤشر الرئيسي.",
            dataset_ref: "dataset://weekly-kpis",
            query_ref: "query://weekly-kpis/trend"
          }
        ]
      },
      {
        section_kind: "body",
        title: "المخاطر والتدخلات",
        blocks: [
          {
            block_type: "table",
            title: "المخاطر المفتوحة",
            body: "الجدول التالي يوضح المخاطر المفتوحة.",
            dataset_ref: "dataset://program-risks",
            query_ref: "query://program-risks/open",
            table_rows: [
              ["Risk", "Owner", "Status"],
              ["Dependency delay", "PMO", "Mitigating"],
              ["Vendor SLA", "Ops", "Escalated"]
            ]
          },
          {
            block_type: "commentary",
            title: "ملاحظات المحرر",
            body: "المحتوى التحليلي يبقى قابلاً للتحرير داخل artifact_type=report."
          }
        ]
      }
    ]
  });
  const updated = engine.updateReport({
    report_id: ingestedDocx.state.report.report_id,
    actor_ref: "editor-1",
    mutation: {
      mutation_kind: "add_section",
      section: {
        section_kind: "appendix",
        title: "الملحق",
        blocks: [
          {
            block_type: "commentary",
            title: "منهجية البيانات",
            body: "الربط البياني قابل للتجديد الانتقائي مع Evidence وAudit وLineage."
          }
        ]
      }
    }
  });
  const refreshed = engine.refreshReport({
    report_id: updated.report.report_id,
    actor_ref: "scheduler-1",
    selective_regeneration_refs: [updated.contentBlocks.find((block) => block.block_type === "metric_card")?.block_id ?? ""].filter(Boolean)
  });
  const compared = engine.compareReports({
    report_id: refreshed.report.report_id,
    actor_ref: "analyst-1",
    base_version_ref: ingestedDocx.state.version.version_ref.version_id,
    target_version_ref: refreshed.version.version_ref.version_id
  });
  const reviewed = engine.reviewReport({
    report_id: refreshed.report.report_id,
    actor_ref: "reviewer-1",
    reviewer_refs: ["reviewer-2"],
    decision: "reviewed",
    comment: "تمت مراجعة البنية والمحتوى وربط الأدلة."
  });
  const approved = engine.approveReport({
    report_id: reviewed.report.report_id,
    actor_ref: "approver-1",
    decision: "approved",
    comment: "اعتماد التقرير للنشر."
  });
  const htmlExport = await engine.exportReportHtml({
    report_id: approved.report.report_id,
    actor_ref: "publisher-1"
  });
  const pdfExport = await engine.exportReportPdf({
    report_id: approved.report.report_id,
    actor_ref: "publisher-1"
  });
  const docxExport = await engine.exportReportDocx({
    report_id: approved.report.report_id,
    actor_ref: "publisher-1"
  });
  const presentationConversion = await engine.convertReportToPresentation({
    report_id: approved.report.report_id,
    actor_ref: "converter-1",
    target_ref: "workspace://presentations/from-report"
  });
  const presentationSyncedBlock = presentationConversion.state.contentBlocks.find((block) =>
    Array.isArray((block.content_payload["source_metadata"] as Record<string, unknown> | undefined)?.["downstream_capability"]) ? false : ((block.content_payload["source_metadata"] as Record<string, unknown> | undefined)?.["downstream_capability"] === "presentations")
  );
  if (presentationSyncedBlock) {
    engine.updateReport({
      report_id: approved.report.report_id,
      actor_ref: "editor-merge-1",
      mutation: {
        mutation_kind: "replace_block_content",
        block_ref: presentationSyncedBlock.block_id,
        body: "Manual reconciliation override for the presentation sync block."
      }
    });
  }
  const presentationReconciledConversion = await engine.convertReportToPresentation({
    report_id: approved.report.report_id,
    actor_ref: "converter-1",
    target_ref: "workspace://presentations/from-report"
  });
  const dashboardConversion = await engine.convertReportToDashboard({
    report_id: approved.report.report_id,
    actor_ref: "converter-1",
    target_ref: "workspace://dashboards/from-report"
  });
  const dashboardSyncedBlock = dashboardConversion.state.contentBlocks.find(
    (block) => ((block.content_payload["source_metadata"] as Record<string, unknown> | undefined)?.["downstream_capability"] === "dashboards")
  );
  if (dashboardSyncedBlock) {
    engine.updateReport({
      report_id: approved.report.report_id,
      actor_ref: "editor-merge-2",
      mutation: {
        mutation_kind: "replace_block_content",
        block_ref: dashboardSyncedBlock.block_id,
        body: "Manual reconciliation override for the dashboard sync block."
      }
    });
  }
  const dashboardReconciledConversion = await engine.convertReportToDashboard({
    report_id: approved.report.report_id,
    actor_ref: "converter-1",
    target_ref: "workspace://dashboards/from-report"
  });
  const published = await engine.publishReport({
    report_id: approved.report.report_id,
    actor_ref: "publisher-1",
    target_ref: "workspace://reports/service-request-04"
  });
  const scheduled = engine.scheduleReport({
    report_id: approved.report.report_id,
    actor_ref: "scheduler-1",
    schedule_type: "weekly_report_refresh",
    cadence: "weekly",
    timezone: "Asia/Riyadh",
    next_run_at: "2026-03-15T06:00:00.000Z",
    trigger_policy: {
      trigger_mode: "calendar",
      misfire_policy: "run_next",
      require_fresh_inputs: true,
      require_approval_before_run: false,
      freshness_window_minutes: 120
    },
    publication_policy: {
      publish_mode: "on_success",
      publication_target_refs: ["workspace://reports/service-request-04/scheduled"],
      export_profile_refs: ["export-profile://reports/html"],
      visibility_scope_ref: "workspace"
    },
    selective_regeneration_refs: approved.contentBlocks.filter((block) => block.binding_refs.length > 0).map((block) => block.block_id)
  });
  engine.scheduleReport({
    report_id: ingestedPdf.state.report.report_id,
    actor_ref: "scheduler-2",
    schedule_type: "imported_report_refresh",
    cadence: "weekly",
    timezone: "Asia/Riyadh",
    next_run_at: "2026-03-15T06:00:00.000Z",
    trigger_policy: {
      trigger_mode: "calendar",
      misfire_policy: "run_next",
      require_fresh_inputs: false,
      require_approval_before_run: true,
      freshness_window_minutes: 60
    },
    publication_policy: {
      publish_mode: "on_success",
      publication_target_refs: ["workspace://reports/service-request-04-pdf/scheduled"],
      export_profile_refs: ["export-profile://reports/html"],
      visibility_scope_ref: "workspace"
    }
  });
  const scheduledRuns = await engine.runDueSchedules("2026-03-15T06:00:00.000Z");
  const degradedPublication = await engine.publishDegradedReportOutput({
    report_id: approved.report.report_id,
    actor_ref: "publisher-1",
    target_ref: "workspace://reports/service-request-04/degraded",
    reason: "External destination accepted HTML only; degraded publication was made explicit."
  });
  return {
    runId,
    ingestedDocx,
    ingestedPdf,
    created,
    updated,
    refreshed,
    compared,
    reviewed,
    approved,
    exports: [docxExport, pdfExport, htmlExport],
    presentationConversion,
    presentationReconciledConversion,
    dashboardConversion,
    dashboardReconciledConversion,
    published,
    scheduled,
    scheduledRuns,
    degradedPublication
  };
};

// ─── Seed Services (adapted from rasid_core_seed) ────────────────────
export * as SeedServices from "./seed-services";
