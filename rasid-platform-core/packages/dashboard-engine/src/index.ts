import { createHash, randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ActionRegistry,
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  DASHBOARD_CONTRACT,
  DashboardBindingSchema,
  DashboardCompareResultSchema,
  DashboardFilterSetSchema,
  DashboardGridDefinitionSchema,
  DashboardInteractionEffectSchema,
  DashboardInteractionRuleSchema,
  DashboardInteractionTriggerSchema,
  DashboardLayoutItemSchema,
  DashboardPageSchema,
  DashboardPublicationMetadataSchema,
  DashboardRefreshPolicySchema,
  DashboardSchema,
  DashboardVersionSchema,
  DashboardWidgetSchema,
  DashboardWidgetTypeSchema,
  EvidencePackSchema,
  JobSchema,
  LibraryAssetSchema,
  PublicationSchema,
  ToolRegistry,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type Dashboard,
  type DashboardBinding,
  type DashboardCompareResult,
  type DashboardFilterSet,
  type DashboardInteractionRule,
  type DashboardLayoutItem,
  type DashboardPage,
  type DashboardVersion,
  type DashboardWidget,
  type EvidencePack,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type PermissionScope,
  type Publication
} from "@rasid/contracts";
import { z } from "zod";
import {
  DashboardEngineStore,
  type PersistedDashboardState,
  type ScheduledRefreshEntry,
  type ScheduledRefreshRunnerJob
} from "./store";

export { DashboardEngineStore, defaultDashboardEngineStorageRoot } from "./store";
export type { PersistedDashboardState, ScheduledRefreshEntry, ScheduledRefreshRunnerJob } from "./store";

const JsonRecordSchema = z.record(z.unknown());
const Meta = { schema_namespace: "rasid.shared.dashboard.v1", schema_version: "1.0.0" } as const;

const DatasetProfileSchema = z.object({
  dataset_ref: z.string(),
  display_name: z.string(),
  dimension_fields: z.array(z.string()).default([]),
  measure_fields: z.array(z.string()).default([]),
  default_query_ref: z.string().optional(),
  suggested_chart_type: z.enum(["bar_chart", "line_chart", "pie_chart", "area_chart", "combo_chart"]).optional(),
  available_filter_fields: z.array(z.string()).default([])
});

const WidgetBlueprintSchema = z.object({
  widget_id: z.string().optional(),
  widget_type: DashboardWidgetTypeSchema,
  title: z.string(),
  subtitle: z.string().default(""),
  page_id: z.string().optional(),
  layout: z
    .object({
      page_id: z.string().optional(),
      x: z.number().int().nonnegative().default(0),
      y: z.number().int().nonnegative().default(0),
      width: z.number().int().positive().default(4),
      height: z.number().int().positive().default(3)
    })
    .optional(),
  binding: z
    .object({
      dataset_ref: z.string(),
      query_ref: z.string().optional(),
      field_mappings: z.array(JsonRecordSchema).default([]),
      calculation_refs: z.array(z.string()).default([])
    })
    .optional(),
  style_config: JsonRecordSchema.default({}),
  interaction_refs: z.array(z.string()).default([]),
  editable: z.boolean().default(true),
  warning_codes: z.array(z.string()).default([]),
  lineage_ref: z.string().optional()
});

const FilterBlueprintSchema = DashboardFilterSetSchema.omit({ schema_namespace: true, schema_version: true, filter_id: true });

const CreateDashboardRequestSchema = z.object({
  dashboard_id: z.string().optional(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  title: z.string(),
  description: z.string().default(""),
  mode: z.enum(["easy", "advanced"]),
  dataset_profiles: z.array(DatasetProfileSchema).min(1),
  widget_blueprints: z.array(WidgetBlueprintSchema).default([]),
  filters: z.array(FilterBlueprintSchema).default([]),
  template_ref: z.string().default(""),
  brand_preset_ref: z.string().default(""),
  refresh_policy: DashboardRefreshPolicySchema.optional(),
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

const DashboardMutationSchema = z.discriminatedUnion("mutation_kind", [
  z.object({ mutation_kind: z.literal("add_widget"), widget: WidgetBlueprintSchema }),
  z.object({ mutation_kind: z.literal("add_page"), page_id: z.string(), title: z.string() }),
  z.object({ mutation_kind: z.literal("remove_widget"), widget_ref: z.string() }),
  z.object({
    mutation_kind: z.literal("move_widget"),
    widget_ref: z.string(),
    layout: z.object({
      page_id: z.string().optional(),
      x: z.number().int().nonnegative().optional(),
      y: z.number().int().nonnegative().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional()
    })
  }),
  z.object({
    mutation_kind: z.literal("resize_widget"),
    widget_ref: z.string(),
    layout: z.object({
      x: z.number().int().nonnegative().optional(),
      y: z.number().int().nonnegative().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional()
    })
  }),
  z.object({
    mutation_kind: z.literal("rebind_widget"),
    widget_ref: z.string(),
    binding: z.object({
      dataset_ref: z.string(),
      query_ref: z.string().optional(),
      field_mappings: z.array(JsonRecordSchema).default([]),
      calculation_refs: z.array(z.string()).default([])
    })
  }),
  z.object({
    mutation_kind: z.literal("update_widget_config"),
    widget_ref: z.string(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    style_config: JsonRecordSchema.optional(),
    interaction_refs: z.array(z.string()).optional(),
    editable: z.boolean().optional(),
    page_id: z.string().optional()
  }),
  z.object({ mutation_kind: z.literal("duplicate_widget"), widget_ref: z.string(), target_page_id: z.string().optional() }),
  z.object({ mutation_kind: z.literal("upsert_filter"), filter_id: z.string().optional(), filter: FilterBlueprintSchema })
]);

const UpdateDashboardRequestSchema = z.object({
  dashboard: DashboardSchema,
  base_version: DashboardVersionSchema,
  actor_ref: z.string(),
  mutation: DashboardMutationSchema,
  timestamp: z.string().optional()
});

const RefreshDashboardRequestSchema = z.object({
  dashboard: DashboardSchema,
  base_version: DashboardVersionSchema,
  actor_ref: z.string(),
  refresh_binding_refs: z.array(z.string()).optional(),
  timestamp: z.string().optional()
});

const PublishDashboardRequestSchema = z.object({
  dashboard: DashboardSchema,
  version: DashboardVersionSchema,
  published_by: z.string(),
  target_ref: z.string(),
  publication_key: z.string().optional(),
  permission_scope: z
    .object({
      visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
      allow_read: z.boolean(),
      allow_write: z.boolean(),
      allow_share: z.boolean(),
      allow_publish: z.boolean(),
      allow_audit_view: z.boolean()
    })
    .optional(),
  publish_to_library: z.boolean().default(true),
  embeddable: z.boolean().default(true),
  timestamp: z.string().optional()
});

const CompareDashboardVersionsRequestSchema = z.object({
  dashboard_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  actor_ref: z.string(),
  base_version: DashboardVersionSchema,
  target_version: DashboardVersionSchema,
  base_snapshot: DashboardSchema,
  target_snapshot: DashboardSchema,
  timestamp: z.string().optional()
});

const ScheduleDashboardRefreshRequestSchema = z.object({
  dashboard_id: z.string(),
  actor_ref: z.string().optional(),
  due_at: z.string().optional(),
  refresh_binding_refs: z.array(z.string()).optional(),
  timestamp: z.string().optional()
});

const ExecuteDashboardInteractionRequestSchema = z.object({
  dashboard: DashboardSchema,
  base_version: DashboardVersionSchema,
  actor_ref: z.string(),
  source_widget_ref: z.string(),
  trigger: DashboardInteractionTriggerSchema,
  effect: DashboardInteractionEffectSchema,
  target_widget_refs: z.array(z.string()).default([]),
  payload: JsonRecordSchema.default({}),
  timestamp: z.string().optional()
});

type DatasetProfile = z.infer<typeof DatasetProfileSchema>;
type WidgetBlueprint = z.infer<typeof WidgetBlueprintSchema>;

export type CreateDashboardRequest = z.infer<typeof CreateDashboardRequestSchema>;
export type UpdateDashboardRequest = z.infer<typeof UpdateDashboardRequestSchema>;
export type RefreshDashboardRequest = z.infer<typeof RefreshDashboardRequestSchema>;
export type PublishDashboardRequest = z.infer<typeof PublishDashboardRequestSchema>;
export type CompareDashboardVersionsRequest = z.infer<typeof CompareDashboardVersionsRequestSchema>;
export type ScheduleDashboardRefreshRequest = z.infer<typeof ScheduleDashboardRefreshRequestSchema>;
export type ExecuteDashboardInteractionRequest = z.infer<typeof ExecuteDashboardInteractionRequestSchema>;

export type DashboardEngineOptions = {
  storageDir?: string;
};

export type DashboardPublicationTransport = {
  backend_ref: string;
  manifest_path: string;
  manifest_uri: string;
  requested_target_ref: string;
  publish_state_path: string;
  publish_state_uri: string;
  embed_payload_path: string | null;
  embed_payload_uri: string | null;
  embed_html_path: string | null;
  embed_html_uri: string | null;
  served_manifest_url: string;
  served_publish_state_url: string;
  served_embed_payload_url: string | null;
  served_embed_html_url: string | null;
  served_base_url: string;
  served_access_token: string;
  access_mode: "read_only" | "editable" | "shared";
};

export type DashboardWorkflowResult = {
  dashboard: Dashboard;
  version: DashboardVersion;
  dashboardArtifact: Artifact;
  versionArtifact: Artifact;
  canonical: CanonicalRepresentation;
  versionCanonical: CanonicalRepresentation;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type DashboardPublicationResult = {
  dashboard: Dashboard;
  version: DashboardVersion;
  publication: Publication;
  libraryAsset: LibraryAsset | null;
  transport: DashboardPublicationTransport;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type DashboardCompareBundle = {
  compareResult: DashboardCompareResult;
  diffArtifact: Artifact;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type DashboardInteractionExecutionResult = {
  interactionRule: DashboardInteractionRule;
  workflow: DashboardWorkflowResult;
  refreshResult: DashboardWorkflowResult | null;
  compareBundle: DashboardCompareBundle | null;
};

const DashboardDispatchRequestSchema = z.object({
  action_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

const DashboardToolDispatchRequestSchema = z.object({
  tool_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

export type DashboardDispatchRequest = z.infer<typeof DashboardDispatchRequestSchema>;
export type DashboardToolDispatchRequest = z.infer<typeof DashboardToolDispatchRequestSchema>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = (value?: string): string => value ?? new Date().toISOString();
const semver = (versionNumber: number) => `1.0.${Math.max(0, versionNumber - 1)}`;
const id = (prefix: string, ...parts: Array<string | number | undefined | null>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
const addMinutes = (timestamp: string, minutes: number): string =>
  new Date(new Date(timestamp).getTime() + minutes * 60 * 1000).toISOString();
const nextScheduleAt = (dashboard: Dashboard, timestamp: string): string | null => {
  if (dashboard.refresh_policy.refresh_mode === "manual" || dashboard.refresh_policy.schedule_kind === "manual") {
    return null;
  }
  const minimumWindow =
    dashboard.refresh_policy.schedule_kind === "hourly"
      ? 60
      : dashboard.refresh_policy.schedule_kind === "daily"
        ? 24 * 60
        : dashboard.refresh_policy.schedule_kind === "weekly"
          ? 7 * 24 * 60
          : 30 * 24 * 60;
  return addMinutes(timestamp, Math.max(minimumWindow, dashboard.refresh_policy.stale_after_minutes));
};
const accessMode = (permissionScope: PermissionScope): DashboardPublicationTransport["access_mode"] =>
  permissionScope.allow_write ? "editable" : permissionScope.allow_share ? "shared" : "read_only";
const normalizeValues = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : value === undefined ? [] : [String(value)];
const dashboardInteractionActionId = (request: ExecuteDashboardInteractionRequest): string =>
  request.payload.action === "refresh" || request.payload.run_refresh === true
    ? "dashboard.interaction.refresh.v1"
    : request.effect === "filter"
      ? "dashboard.interaction.filter.v1"
      : request.effect === "highlight"
        ? "dashboard.interaction.selection.v1"
        : request.effect === "navigate"
          ? "dashboard.interaction.drill.v1"
          : "dashboard.interaction.compare.v1";
type ServedPublicationRoute = {
  accessToken: string;
  manifestPath: string;
  publishStatePath: string;
  embedPayloadPath: string | null;
  embedHtmlPath: string | null;
};
type ServedPublicationManifest = {
  backend_ref: string;
  publication_id: string;
  dashboard_id: string;
  version_id: string;
  artifact_ref: string;
  requested_target_ref: string;
  permission_scope: PermissionScope;
  access_mode: DashboardPublicationTransport["access_mode"];
  published_at: string;
};
type ServedPublicationSnapshot = {
  publication_id: string;
  manifest: ServedPublicationManifest;
  dashboard: Dashboard;
  version: DashboardVersion;
  publication: Publication | null;
  access_mode: DashboardPublicationTransport["access_mode"];
  filter_sets: DashboardFilterSet[];
  widgets: Array<{
    widget_id: string;
    widget_type: string;
    title: string;
    subtitle: string;
    page_id: string;
    binding_refs: string[];
    query_ref: string | null;
    style_config: Record<string, unknown>;
  }>;
  bindings: Array<{
    binding_id: string;
    dataset_ref: string;
    query_ref: string;
    target_widget_ref: string;
    refresh_state: string;
    last_refresh_at: string | null;
  }>;
  compare_results: DashboardCompareResult[];
  evidence: EvidencePack[];
  audit: AuditEvent[];
  lineage: LineageEdge[];
};
const DASHBOARD_TRANSPORT_HOST = process.env.RASID_DASHBOARD_TRANSPORT_HOST ?? "127.0.0.1";
const allocateDashboardTransportPort = (): number => {
  try {
    const output = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'),0); $listener.Start(); $port = ($listener.LocalEndpoint).Port; $listener.Stop(); Write-Output $port"
      ],
      { encoding: "utf8" }
    ).trim();
    const parsed = Number(output);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    // Fall through to deterministic high port only if the OS probe fails.
  }
  return 39000 + (process.pid % 1000);
};
let dashboardTransportPort = Number(process.env.RASID_DASHBOARD_TRANSPORT_PORT ?? "0");
if (!Number.isFinite(dashboardTransportPort) || dashboardTransportPort <= 0) {
  dashboardTransportPort = allocateDashboardTransportPort();
}
let dashboardTransportServer: Server | null = null;
let dashboardTransportStore: DashboardEngineStore | null = null;
const servedPublicationRoutes = new Map<string, ServedPublicationRoute>();
const servedPublicationUrl = (publicationId: string, asset: "manifest" | "state" | "embed-payload" | "embed", accessToken: string) =>
  `http://${DASHBOARD_TRANSPORT_HOST}:${dashboardTransportPort}/publications/${publicationId}/${asset}?access_token=${accessToken}`;
const parseTransportBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body.length > 0 ? (JSON.parse(body) as Record<string, unknown>) : {};
};
const writeTransportJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};
const resolveServedPublicationRoute = (publicationId: string): ServedPublicationRoute | null => {
  const route = servedPublicationRoutes.get(publicationId);
  if (route) {
    return route;
  }
  const transport = dashboardTransportStore?.loadPublicationTransport(publicationId);
  if (!transport) {
    return null;
  }
  const restored = {
    accessToken: transport.served_access_token,
    manifestPath: transport.manifest_path,
    publishStatePath: transport.publish_state_path,
    embedPayloadPath: transport.embed_payload_path,
    embedHtmlPath: transport.embed_html_path
  } satisfies ServedPublicationRoute;
  servedPublicationRoutes.set(publicationId, restored);
  return restored;
};
const loadServedPublicationManifest = (publicationId: string): ServedPublicationManifest | null => {
  const route = resolveServedPublicationRoute(publicationId);
  if (!route || !fs.existsSync(route.manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(route.manifestPath, "utf8")) as ServedPublicationManifest;
};
const loadServedPublicationSnapshot = (publicationId: string): ServedPublicationSnapshot | null => {
  const manifest = loadServedPublicationManifest(publicationId);
  const store = dashboardTransportStore;
  if (!manifest || !store) {
    return null;
  }
  const state = store.loadDashboardState(manifest.dashboard_id);
  const current = store.loadDashboardVersion(manifest.dashboard_id, state.version.version_id);
  const publication =
    store.listPublications(manifest.dashboard_id).find((entry) => entry.publication_id === publicationId) ??
    store.loadLatestPublication(manifest.dashboard_id);
  return {
    publication_id: publicationId,
    manifest,
    dashboard: current.dashboard,
    version: current.version,
    publication,
    access_mode: manifest.access_mode,
    filter_sets: current.dashboard.filter_sets,
    widgets: current.dashboard.widgets.map((widget) => {
      const binding = current.dashboard.bindings.find((entry) => entry.target_widget_ref === widget.widget_id);
      return {
        widget_id: widget.widget_id,
        widget_type: widget.widget_type,
        title: widget.title,
        subtitle: widget.subtitle,
        page_id: widget.page_id,
        binding_refs: widget.binding_refs,
        query_ref: binding?.query_ref ?? null,
        style_config: widget.style_config
      };
    }),
    bindings: current.dashboard.bindings.map((binding) => ({
      binding_id: binding.binding_id,
      dataset_ref: binding.dataset_ref,
      query_ref: binding.query_ref,
      target_widget_ref: binding.target_widget_ref,
      refresh_state: binding.refresh_state,
      last_refresh_at: binding.last_refresh_at
    })),
    compare_results: store.listCompareResults(manifest.dashboard_id).slice(-5),
    evidence: store.listEvidencePacks(manifest.dashboard_id).slice(-5),
    audit: store.listAuditEvents(manifest.dashboard_id).slice(-5),
    lineage: store.listLineageEdges(manifest.dashboard_id).slice(-5)
  };
};
const servedPublicationActorRef = (publicationId: string) => `dashboard-publication:${publicationId}`;
const runServedPublicationAction = (publicationId: string, kind: string, payload: Record<string, unknown>) => {
  const snapshot = loadServedPublicationSnapshot(publicationId);
  if (!snapshot || !dashboardTransportStore) {
    throw new Error(`Unknown publication ${publicationId}`);
  }
  const runtime = new DashboardEngine({ storageDir: dashboardTransportStore.rootDir });
  const actorRef = servedPublicationActorRef(publicationId);
  const sourceWidgetRef = String(payload.source_widget_ref ?? snapshot.dashboard.widgets[0]?.widget_id ?? "");
  if (!sourceWidgetRef) {
    throw new Error("Published dashboard has no source widget to drive interactions.");
  }
  if (kind === "refresh") {
    const refresh = runtime.refreshDashboard({
      dashboard: snapshot.dashboard,
      base_version: snapshot.version,
      actor_ref: actorRef,
      refresh_binding_refs: Array.isArray(payload.refresh_binding_refs)
        ? payload.refresh_binding_refs.map((entry) => String(entry))
        : undefined
    });
    return {
      snapshot: loadServedPublicationSnapshot(publicationId),
      emitted_refs: {
        evidence: [refresh.evidencePack.evidence_pack_id],
        audit: refresh.auditEvents.map((entry) => entry.event_id),
        lineage: refresh.lineageEdges.map((entry) => entry.edge_id),
        version: refresh.version.version_id
      }
    };
  }
  if (kind === "compare") {
    const baseVersionRef = String(payload.compare_base_version_ref ?? snapshot.manifest.version_id);
    const base = dashboardTransportStore.loadDashboardVersion(snapshot.dashboard.dashboard_id, baseVersionRef);
    const compare = runtime.compareDashboardVersions({
      dashboard_id: snapshot.dashboard.dashboard_id,
      tenant_ref: snapshot.dashboard.tenant_ref,
      workspace_id: snapshot.dashboard.workspace_id,
      actor_ref: actorRef,
      base_version: base.version,
      target_version: snapshot.version,
      base_snapshot: base.dashboard,
      target_snapshot: snapshot.dashboard
    });
    return {
      snapshot: loadServedPublicationSnapshot(publicationId),
      emitted_refs: {
        evidence: [compare.evidencePack.evidence_pack_id],
        audit: compare.auditEvents.map((entry) => entry.event_id),
        lineage: compare.lineageEdges.map((entry) => entry.edge_id),
        compare: compare.compareResult.compare_id
      }
    };
  }
  const interactionKinds: Record<string, { trigger: z.infer<typeof DashboardInteractionTriggerSchema>; effect: z.infer<typeof DashboardInteractionEffectSchema> }> = {
    filter: { trigger: "filter_change", effect: "filter" },
    selection: { trigger: "selection", effect: "highlight" },
    drill: { trigger: "drill_down", effect: "navigate" }
  };
  const interactionKind = interactionKinds[kind];
  if (!interactionKind) {
    throw new Error(`Unsupported served publication interaction: ${kind}`);
  }
  const execution = runtime.executeInteraction({
    dashboard: snapshot.dashboard,
    base_version: snapshot.version,
    actor_ref: actorRef,
    source_widget_ref: sourceWidgetRef,
    trigger: interactionKind.trigger,
    effect: interactionKind.effect,
    target_widget_refs: Array.isArray(payload.target_widget_refs)
      ? payload.target_widget_refs.map((entry) => String(entry))
      : snapshot.dashboard.widgets.filter((widget) => widget.widget_id !== sourceWidgetRef).map((widget) => widget.widget_id),
    payload: {
      dataset_ref: payload.dataset_ref ?? snapshot.dashboard.source_dataset_refs[0] ?? "",
      field_ref: String(payload.field_ref ?? snapshot.dashboard.filter_sets[0]?.field_ref ?? ""),
      values: normalizeValues(payload.values),
      run_refresh: payload.run_refresh ?? kind === "filter",
      action: kind
    }
  });
  return {
    snapshot: loadServedPublicationSnapshot(publicationId),
    emitted_refs: {
      evidence: [
        execution.workflow.evidencePack.evidence_pack_id,
        ...(execution.refreshResult ? [execution.refreshResult.evidencePack.evidence_pack_id] : []),
        ...(execution.compareBundle ? [execution.compareBundle.evidencePack.evidence_pack_id] : [])
      ],
      audit: [
        ...execution.workflow.auditEvents.map((entry) => entry.event_id),
        ...(execution.refreshResult ? execution.refreshResult.auditEvents.map((entry) => entry.event_id) : []),
        ...(execution.compareBundle ? execution.compareBundle.auditEvents.map((entry) => entry.event_id) : [])
      ],
      lineage: [
        ...execution.workflow.lineageEdges.map((entry) => entry.edge_id),
        ...(execution.refreshResult ? execution.refreshResult.lineageEdges.map((entry) => entry.edge_id) : []),
        ...(execution.compareBundle ? execution.compareBundle.lineageEdges.map((entry) => entry.edge_id) : [])
      ],
      version: execution.refreshResult?.version.version_id ?? execution.workflow.version.version_id,
      compare: execution.compareBundle?.compareResult.compare_id ?? null
    }
  };
};
const ensureDashboardTransportServer = (store?: DashboardEngineStore, keepAlive = false): void => {
  dashboardTransportStore ??= store ?? new DashboardEngineStore();
  if (dashboardTransportServer) {
    return;
  }
  dashboardTransportServer = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${DASHBOARD_TRANSPORT_HOST}:${dashboardTransportPort}`);
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "publications") {
      response.statusCode = 404;
      response.end("not_found");
      return;
    }
    const publicationId = parts[1];
    const asset = parts[2];
    const route = resolveServedPublicationRoute(publicationId);
    if (!route || requestUrl.searchParams.get("access_token") !== route.accessToken) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }
    if (parts.length === 3 && parts[2] === "runtime-state") {
      writeTransportJson(response, 200, loadServedPublicationSnapshot(publicationId));
      return;
    }
    if (parts.length === 3 && parts[2] === "evidence") {
      writeTransportJson(response, 200, loadServedPublicationSnapshot(publicationId)?.evidence ?? []);
      return;
    }
    if (parts.length === 3 && parts[2] === "audit") {
      writeTransportJson(response, 200, loadServedPublicationSnapshot(publicationId)?.audit ?? []);
      return;
    }
    if (parts.length === 3 && parts[2] === "lineage") {
      writeTransportJson(response, 200, loadServedPublicationSnapshot(publicationId)?.lineage ?? []);
      return;
    }
    if (parts.length === 4 && parts[2] === "interactions" && request.method === "POST") {
      parseTransportBody(request)
        .then((payload) => writeTransportJson(response, 200, runServedPublicationAction(publicationId, parts[3] ?? "", payload)))
        .catch((error) => {
          response.statusCode = 500;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
        });
      return;
    }
    const filePath =
      asset === "manifest"
        ? route.manifestPath
        : asset === "state"
          ? route.publishStatePath
          : asset === "embed-payload"
            ? route.embedPayloadPath
            : asset === "embed"
              ? route.embedHtmlPath
              : null;
    if (!filePath || !fs.existsSync(filePath)) {
      response.statusCode = 404;
      response.end("missing");
      return;
    }
    response.statusCode = 200;
    response.setHeader(
      "content-type",
      asset === "embed" ? "text/html; charset=utf-8" : "application/json; charset=utf-8"
    );
    response.end(fs.readFileSync(filePath));
  });
  dashboardTransportServer.listen(dashboardTransportPort, DASHBOARD_TRANSPORT_HOST);
  const address = dashboardTransportServer.address();
  if (address && typeof address === "object") {
    dashboardTransportPort = address.port;
  }
  if (!keepAlive) {
    dashboardTransportServer.unref();
  }
};
const registerServedPublicationRoute = (
  store: DashboardEngineStore,
  publicationId: string,
  manifestPath: string,
  publishStatePath: string,
  embedPayloadPath: string | null,
  embedHtmlPath: string | null
) => {
  ensureDashboardTransportServer(store);
  const accessToken = createHash("sha256")
    .update([publicationId, manifestPath, publishStatePath, embedPayloadPath ?? "", embedHtmlPath ?? ""].join("|"))
    .digest("hex")
    .slice(0, 24);
  servedPublicationRoutes.set(publicationId, {
    accessToken,
    manifestPath,
    publishStatePath,
    embedPayloadPath,
    embedHtmlPath
  });
  return {
    served_base_url: `http://${DASHBOARD_TRANSPORT_HOST}:${dashboardTransportPort}/publications/${publicationId}`,
    served_manifest_url: servedPublicationUrl(publicationId, "manifest", accessToken),
    served_publish_state_url: servedPublicationUrl(publicationId, "state", accessToken),
    served_embed_payload_url: embedPayloadPath ? servedPublicationUrl(publicationId, "embed-payload", accessToken) : null,
    served_embed_html_url: embedHtmlPath ? servedPublicationUrl(publicationId, "embed", accessToken) : null,
    served_access_token: accessToken
  };
};

const verification = (dashboard: Dashboard) =>
  dashboard.bindings.some((binding) => binding.refresh_state === "broken")
    ? "degraded"
    : dashboard.bindings.some((binding) => binding.refresh_state !== "fresh" || binding.warning_codes.length > 0)
      ? "success_with_warnings"
      : "verified";

const warnings = (dashboard: Dashboard) =>
  dashboard.bindings
    .filter((binding) => binding.refresh_state !== "fresh" || binding.warning_codes.length > 0)
    .map((binding) => ({
      warning_code: binding.warning_codes[0] ?? `binding_${binding.refresh_state}`,
      summary: `Binding ${binding.binding_id} is ${binding.refresh_state}`,
      detail: `Dashboard binding ${binding.binding_id} requires attention.`,
      severity: binding.refresh_state === "broken" ? "high" : "medium",
      impacted_refs: [binding.binding_id, binding.target_widget_ref]
    }));

const failures = (dashboard: Dashboard) =>
  dashboard.bindings
    .filter((binding) => binding.refresh_state === "broken")
    .map((binding) => ({
      reason_code: "broken_binding",
      summary: `Binding ${binding.binding_id} is broken`,
      detail: `Widget ${binding.target_widget_ref} lost its dataset binding.`,
      impacted_refs: [binding.binding_id, binding.target_widget_ref],
      retryable: true
    }));

const sourceDescriptors = (profiles: DatasetProfile[]) =>
  profiles.map((profile) => ({
    source_ref: profile.dataset_ref,
    source_type: "normalized_dataset",
    source_revision_ref: `${profile.dataset_ref}:latest`,
    parser_profile: "dashboard_binding",
    connector_ref: "connector.shared.dataset"
  }));

const ensurePage = (pages: DashboardPage[], pageId: string): DashboardPage[] =>
  pages.some((page) => page.page_id === pageId)
    ? pages
    : [
        ...pages,
        DashboardPageSchema.parse({
          ...Meta,
          page_id: pageId,
          title: "Overview",
          tab_order: pages.length,
          default_page: pages.length === 0,
          layout_grid: { ...Meta, columns: 12, row_height: 120, gap: 1 },
          widget_refs: [],
          filter_refs: []
        })
      ];

const attachWidgetToPage = (pages: DashboardPage[], pageId: string, widgetId: string): DashboardPage[] =>
  pages.map((page) =>
    page.page_id === pageId
      ? DashboardPageSchema.parse({
          ...page,
          widget_refs: page.widget_refs.includes(widgetId) ? page.widget_refs : [...page.widget_refs, widgetId]
        })
      : page
  );

const autoBlueprints = (profiles: DatasetProfile[]): WidgetBlueprint[] =>
  profiles.flatMap((profile, index) => {
    const widgets: WidgetBlueprint[] = [];
    if (profile.measure_fields[0]) {
      widgets.push(WidgetBlueprintSchema.parse({
        widget_type: "kpi_card",
        title: `${profile.display_name} KPI`,
        subtitle: profile.measure_fields[0],
        page_id: "page-overview",
        layout: { page_id: "page-overview", x: (index % 3) * 4, y: Math.floor(index / 3) * 2, width: 4, height: 2 },
        binding: {
          dataset_ref: profile.dataset_ref,
          query_ref: profile.default_query_ref ?? `${profile.dataset_ref}:summary`,
          field_mappings: [{ role: "metric", field: profile.measure_fields[0] }],
          calculation_refs: []
        },
        style_config: {},
        interaction_refs: [],
        editable: true,
        warning_codes: []
      }));
    }
    if (profile.measure_fields[0] && profile.dimension_fields[0]) {
      widgets.push(WidgetBlueprintSchema.parse({
        widget_type: profile.suggested_chart_type ?? "bar_chart",
        title: `${profile.display_name} Trend`,
        subtitle: `${profile.dimension_fields[0]} vs ${profile.measure_fields[0]}`,
        page_id: "page-overview",
        layout: { page_id: "page-overview", x: 0, y: 3 + index * 3, width: 6, height: 3 },
        binding: {
          dataset_ref: profile.dataset_ref,
          query_ref: profile.default_query_ref ?? `${profile.dataset_ref}:chart`,
          field_mappings: [
            { role: "dimension", field: profile.dimension_fields[0] },
            { role: "measure", field: profile.measure_fields[0] }
          ],
          calculation_refs: []
        },
        style_config: {},
        interaction_refs: [],
        editable: true,
        warning_codes: []
      }));
    }
    widgets.push(WidgetBlueprintSchema.parse({
      widget_type: "table",
      title: `${profile.display_name} Table`,
      subtitle: "Baseline table",
      page_id: "page-overview",
      layout: { page_id: "page-overview", x: 6, y: 3 + index * 3, width: 6, height: 3 },
      binding: {
        dataset_ref: profile.dataset_ref,
        query_ref: profile.default_query_ref ?? `${profile.dataset_ref}:table`,
        field_mappings: [
          ...profile.dimension_fields.slice(0, 2).map((field) => ({ role: "dimension", field })),
          ...profile.measure_fields.slice(0, 2).map((field) => ({ role: "measure", field }))
        ],
        calculation_refs: []
      },
      style_config: {},
      interaction_refs: [],
      editable: true,
      warning_codes: []
    }));
    return widgets;
  });

const buildWidget = (blueprint: WidgetBlueprint, dashboardId: string, index: number, timestamp: string) => {
  const widgetId = blueprint.widget_id ?? id("widget", dashboardId, index);
  const pageId = blueprint.page_id ?? blueprint.layout?.page_id ?? "page-overview";
  const layoutId = id("layout", widgetId);
  const bindingId = blueprint.binding ? id("binding", blueprint.binding.dataset_ref, widgetId) : null;

  const layout = DashboardLayoutItemSchema.parse({
    ...Meta,
    item_id: layoutId,
    page_id: pageId,
    x: blueprint.layout?.x ?? 0,
    y: blueprint.layout?.y ?? index * 2,
    width: blueprint.layout?.width ?? 4,
    height: blueprint.layout?.height ?? 3,
    z_index: index,
    min_width: 2,
    min_height: 2,
    max_width: 12,
    max_height: 12,
    container_item_ref: null,
    locked: false,
    responsive_behavior: "stretch"
  });

  const widget = DashboardWidgetSchema.parse({
    ...Meta,
    widget_id: widgetId,
    page_id: pageId,
    widget_type: blueprint.widget_type,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    binding_refs: bindingId ? [bindingId] : [],
    layout_item_ref: layoutId,
    style_config: blueprint.style_config,
    interaction_refs: blueprint.interaction_refs,
    editable: blueprint.editable,
    warning_codes: blueprint.warning_codes,
    degrade_state: blueprint.warning_codes.length > 0 ? "partial" : "none",
    lineage_ref: blueprint.lineage_ref ?? id("lineage", widgetId, timestamp)
  });

  const binding = bindingId
    ? DashboardBindingSchema.parse({
        ...Meta,
        binding_id: bindingId,
        dataset_ref: blueprint.binding!.dataset_ref,
        query_ref: blueprint.binding!.query_ref ?? `${blueprint.binding!.dataset_ref}:default`,
        target_widget_ref: widgetId,
        field_mappings: blueprint.binding!.field_mappings,
        calculation_refs: blueprint.binding!.calculation_refs,
        refresh_state: "fresh",
        last_refresh_at: timestamp,
        warning_codes: []
      })
    : null;

  return { widget, layout, binding };
};

const buildCanonical = (dashboard: Dashboard, canonicalId: string, timestamp: string, profiles: DatasetProfile[]) =>
  CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: canonicalId,
    tenant_ref: dashboard.tenant_ref,
    workspace_id: dashboard.workspace_id,
    project_id: dashboard.project_id,
    source_descriptors: sourceDescriptors(profiles),
    representation_kind: "dashboard",
    strictness_mode: "smart",
    localization: { locale: "ar-SA", rtl: true, numeral_system: "arab", fallback_locales: ["en-US"] },
    root_node_refs: [id("node-document", dashboard.dashboard_id)],
    nodes: {
      documents: [
        {
          node_id: id("node-document", dashboard.dashboard_id),
          node_type: "document",
          parent_node_ref: null,
          child_node_refs: dashboard.pages.map((page) => id("node-page", page.page_id)),
          name: dashboard.title,
          semantic_labels: ["dashboard_root"],
          layout_ref: "",
          data_binding_refs: dashboard.bindings.map((binding) => binding.binding_id),
          formula_refs: [],
          lineage_refs: dashboard.widgets.map((widget) => widget.lineage_ref),
          template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
          evidence_refs: [],
          editable: true,
          page_refs: dashboard.pages.map((page) => id("node-page", page.page_id)),
          section_refs: []
        }
      ],
      pages: dashboard.pages.map((page) => ({
        node_id: id("node-page", page.page_id),
        node_type: "page",
        parent_node_ref: id("node-document", dashboard.dashboard_id),
        child_node_refs: page.widget_refs.map((widgetId) => id("node-widget", widgetId)),
        name: page.title,
        semantic_labels: ["dashboard_page"],
        layout_ref: page.page_id,
        data_binding_refs: dashboard.bindings.filter((binding) => page.widget_refs.includes(binding.target_widget_ref)).map((binding) => binding.binding_id),
        formula_refs: [],
        lineage_refs: dashboard.widgets.filter((widget) => page.widget_refs.includes(widget.widget_id)).map((widget) => widget.lineage_ref),
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: true,
        width: 1440,
        height: 900,
        unit: "px",
        layer_refs: page.widget_refs.map((widgetId) => id("node-widget", widgetId))
      })),
      sheets: [],
      slides: [],
      tables: dashboard.widgets.filter((widget) => widget.widget_type === "table").map((widget) => ({
        node_id: id("node-widget", widget.widget_id),
        node_type: "table",
        parent_node_ref: id("node-page", widget.page_id),
        child_node_refs: [],
        name: widget.title,
        semantic_labels: ["dashboard_widget", widget.widget_type],
        layout_ref: widget.layout_item_ref,
        data_binding_refs: widget.binding_refs,
        formula_refs: [],
        lineage_refs: [widget.lineage_ref],
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: widget.editable,
        row_count: 10,
        column_count: 5,
        schema_ref: "schema://dashboard-table/1.0.0"
      })),
      charts: dashboard.widgets.filter((widget) => ["bar_chart", "line_chart", "pie_chart", "area_chart", "combo_chart", "compare_chart", "heatmap", "top_bottom", "growth_indicator", "anomaly_alert", "scatter_3d"].includes(widget.widget_type)).map((widget) => ({
        node_id: id("node-widget", widget.widget_id),
        node_type: "chart",
        parent_node_ref: id("node-page", widget.page_id),
        child_node_refs: [],
        name: widget.title,
        semantic_labels: ["dashboard_widget", widget.widget_type],
        layout_ref: widget.layout_item_ref,
        data_binding_refs: widget.binding_refs,
        formula_refs: [],
        lineage_refs: [widget.lineage_ref],
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: widget.editable,
        chart_type: widget.widget_type,
        series_refs: widget.binding_refs,
        axis_refs: []
      })),
      shapes: dashboard.widgets.filter((widget) => ["filter", "selector", "section", "map"].includes(widget.widget_type)).map((widget) => ({
        node_id: id("node-widget", widget.widget_id),
        node_type: "shape",
        parent_node_ref: id("node-page", widget.page_id),
        child_node_refs: [],
        name: widget.title,
        semantic_labels: ["dashboard_widget", widget.widget_type],
        layout_ref: widget.layout_item_ref,
        data_binding_refs: widget.binding_refs,
        formula_refs: [],
        lineage_refs: [widget.lineage_ref],
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: widget.editable,
        shape_type: widget.widget_type,
        style_ref: "style://dashboard/default"
      })),
      text: dashboard.widgets.filter((widget) => ["kpi_card", "text"].includes(widget.widget_type)).map((widget) => ({
        node_id: id("node-widget", widget.widget_id),
        node_type: "text",
        parent_node_ref: id("node-page", widget.page_id),
        child_node_refs: [],
        name: widget.title,
        semantic_labels: ["dashboard_widget", widget.widget_type],
        layout_ref: widget.layout_item_ref,
        data_binding_refs: widget.binding_refs,
        formula_refs: [],
        lineage_refs: [widget.lineage_ref],
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: widget.editable,
        content: [{ value: `${widget.title}${widget.subtitle ? ` - ${widget.subtitle}` : ""}`, locale: "ar-SA", rtl: true }],
        typography_ref: "typography://dashboard/default"
      })),
      images: dashboard.widgets.filter((widget) => widget.widget_type === "image").map((widget) => ({
        node_id: id("node-widget", widget.widget_id),
        node_type: "image",
        parent_node_ref: id("node-page", widget.page_id),
        child_node_refs: [],
        name: widget.title,
        semantic_labels: ["dashboard_widget", widget.widget_type],
        layout_ref: widget.layout_item_ref,
        data_binding_refs: widget.binding_refs,
        formula_refs: [],
        lineage_refs: [widget.lineage_ref],
        template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
        evidence_refs: [],
        editable: widget.editable,
        image_asset_ref: "",
        crop_metadata: {}
      }))
    },
    layout_metadata: {
      coordinate_space: "canvas",
      bounding_boxes: dashboard.layout_items.map((item) => ({ item_ref: item.item_id, x: item.x, y: item.y, width: item.width, height: item.height })),
      z_order: dashboard.layout_items.map((item) => ({ item_ref: item.item_id, z_index: item.z_index })),
      grid_rules: dashboard.pages.map((page) => ({ page_id: page.page_id, columns: page.layout_grid.columns, row_height: page.layout_grid.row_height, gap: page.layout_grid.gap })),
      alignment_rules: []
    },
    data_binding_refs: dashboard.bindings.map((binding) => ({ binding_id: binding.binding_id, dataset_ref: binding.dataset_ref, query_ref: binding.query_ref, target_node_ref: id("node-widget", binding.target_widget_ref), field_mappings: binding.field_mappings })),
    formula_refs: [],
    semantic_labels: dashboard.widgets.map((widget) => ({ label_id: id("label", widget.widget_id), label_type: "widget_type", label_value: widget.widget_type, target_ref: widget.widget_id })),
    lineage_refs: dashboard.widgets.map((widget) => widget.lineage_ref),
    template_refs: dashboard.template_ref ? [dashboard.template_ref] : [],
    editability_flags: { default_editable: true, locked_region_refs: dashboard.editability.hard_lock_refs, lock_reason_codes: dashboard.editability.hard_lock_refs.map(() => "hard_lock") },
    evidence_refs: [],
    created_at: dashboard.created_at,
    updated_at: timestamp
  });

const createVersion = (
  dashboard: Dashboard,
  versionNumber: number,
  parentVersionId: string | null,
  createdBy: string,
  changeSummary: string,
  createdFrom: DashboardVersion["created_from"],
  timestamp: string
) =>
  DashboardVersionSchema.parse({
    contract: DASHBOARD_CONTRACT,
    ...Meta,
    version_id: id("dashboard-version", dashboard.dashboard_id, versionNumber),
    dashboard_ref: dashboard.dashboard_id,
    parent_version_id: parentVersionId,
    version_number: versionNumber,
    semantic_version: semver(versionNumber),
    change_summary: changeSummary,
    created_from: createdFrom,
    created_at: timestamp,
    created_by: createdBy,
    compare_base_version_ref: parentVersionId,
    refresh_job_ref: null,
    publication_state: dashboard.publication_metadata.publication_state,
    stale_binding_count: dashboard.bindings.filter((binding) => binding.refresh_state !== "fresh").length,
    snapshot_artifact_ref: id("artifact", dashboard.dashboard_id, "dashboard-version", versionNumber),
    snapshot_canonical_ref: id("canonical", dashboard.dashboard_id, "dashboard-version", versionNumber)
  });

const buildWorkflow = (
  dashboard: Dashboard,
  version: DashboardVersion,
  profiles: DatasetProfile[],
  actionId: string,
  stage: string,
  timestamp: string,
  actorRef: string
): DashboardWorkflowResult => {
  const canonical = buildCanonical(dashboard, dashboard.canonical_ref, timestamp, profiles);
  const versionCanonical = buildCanonical(dashboard, version.snapshot_canonical_ref, timestamp, profiles);
  const makeArtifact = (artifactId: string, subtype: string, canonicalRef: string) =>
    ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: artifactId,
      artifact_type: "dashboard",
      artifact_subtype: subtype,
      project_id: dashboard.project_id,
      workspace_id: dashboard.workspace_id,
      source_refs: dashboard.source_dataset_refs,
      parent_artifact_refs: version.parent_version_id ? [version.parent_version_id] : [],
      canonical_ref: canonicalRef,
      created_by: version.created_by,
      created_at: timestamp,
      mode: dashboard.mode,
      editable_status: "editable",
      template_status: dashboard.template_ref ? "applied" : "none",
      lineage_ref: id("lineage-artifact", artifactId),
      evidence_ref: id("evidence", dashboard.dashboard_id, version.version_id),
      verification_status: verification(dashboard),
      storage_ref: { storage_id: id("storage", artifactId), storage_class: "object", uri: `memory://dashboards/${dashboard.dashboard_id}/${artifactId}`, checksum: `sha256:${artifactId}`, region: "workspace" },
      preview_ref: { preview_id: id("preview", artifactId), preview_type: "html_canvas", storage_ref: id("storage", artifactId) },
      export_refs: [{ export_id: id("export", artifactId, "json"), export_type: "json", explicit_non_editable: false, storage_ref: id("storage", artifactId) }],
      version_ref: { version_id: version.version_id, parent_version_id: version.parent_version_id, version_number: version.version_number, semantic_version: version.semantic_version },
      tenant_ref: dashboard.tenant_ref,
      permission_scope: dashboard.permission_scope
    });
  const dashboardArtifact = makeArtifact(dashboard.artifact_ref, "editable_dashboard", dashboard.canonical_ref);
  const versionArtifact = makeArtifact(version.snapshot_artifact_ref, "dashboard_version", version.snapshot_canonical_ref);
  const evidencePack = EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence", dashboard.dashboard_id, version.version_id, stage),
    verification_status: verification(dashboard),
    source_refs: dashboard.source_dataset_refs,
    generated_artifact_refs: [dashboardArtifact.artifact_id, versionArtifact.artifact_id],
    checks_executed: [
      { check_id: id("check", dashboard.dashboard_id, "layout", stage), check_name: "layout_integrity_check", check_type: stage, passed: dashboard.layout_items.length >= dashboard.widgets.length, severity: "high", details: "Layout items cover the widget set.", impacted_refs: dashboard.layout_items.map((item) => item.item_id) },
      { check_id: id("check", dashboard.dashboard_id, "bindings", stage), check_name: "binding_integrity_check", check_type: stage, passed: dashboard.bindings.every((binding) => binding.target_widget_ref.length > 0), severity: "high", details: "Bindings resolve to widget targets.", impacted_refs: dashboard.bindings.map((binding) => binding.binding_id) }
    ],
    before_refs: version.parent_version_id ? [version.parent_version_id] : [],
    after_refs: [version.version_id],
    metrics: [
      { metric_name: "widget_count", metric_value: dashboard.widgets.length, metric_unit: "widgets" },
      { metric_name: "binding_count", metric_value: dashboard.bindings.length, metric_unit: "bindings" },
      { metric_name: "page_count", metric_value: dashboard.pages.length, metric_unit: "pages" }
    ],
    warnings: warnings(dashboard),
    failure_reasons: failures(dashboard),
    degraded_reasons: failures(dashboard),
    replay_context: { action_id: actionId, stage, dashboard_id: dashboard.dashboard_id },
    reproducibility_metadata: { replay_token: id("replay", dashboard.dashboard_id, version.version_id, stage), execution_seed: `${dashboard.dashboard_id}:${version.version_id}:${stage}`, environment_stamp: "rasid-platform-core", tool_versions: [{ tool: "dashboard-engine", version: "1.0.0" }] },
    strict_evidence_level: "standard"
  });
  const job = JobSchema.parse({
    contract: contractEnvelope("job"),
    job_id: id("job", dashboard.dashboard_id, version.version_id, stage),
    capability: "dashboards",
    requested_mode: dashboard.mode,
    capability_submode: stage,
    source_refs: dashboard.source_dataset_refs,
    artifact_refs: [dashboard.artifact_ref, version.snapshot_artifact_ref],
    progress: 100,
    stage,
    state: "completed",
    warnings: warnings(dashboard),
    failure_reason: failures(dashboard)[0] ?? null,
    retry_policy: { max_attempts: 3, strategy: "exponential", backoff_ms: 1000 },
    evidence_ref: evidencePack.evidence_pack_id,
    started_at: timestamp,
    finished_at: timestamp,
    resource_profile: { cpu_class: "standard", memory_class: "medium", io_class: "balanced", expected_parallelism: 2 }
  });
  const auditEvents = [
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", dashboard.dashboard_id, actionId, timestamp),
      timestamp,
      actor_ref: actorRef,
      actor_type: "service",
      action_ref: actionId,
      job_ref: job.job_id,
      object_refs: [dashboard.dashboard_id, version.version_id],
      workspace_id: dashboard.workspace_id,
      tenant_ref: dashboard.tenant_ref,
      metadata: { stage, mode: dashboard.mode, version_number: version.version_number }
    })
  ];
  const lineageEdges: LineageEdge[] = [
    ...dashboard.source_dataset_refs.map((sourceRef) => ({ edge_id: id("edge", sourceRef, dashboard.dashboard_id), from_ref: sourceRef, to_ref: dashboard.artifact_ref, transform_ref: "dashboard.create", ai_suggestion_ref: "", ai_decision: "not_applicable" as const, template_ref: dashboard.template_ref, dataset_binding_ref: "", version_diff_ref: "" })),
    ...dashboard.bindings.map((binding) => ({ edge_id: id("edge", binding.binding_id, binding.target_widget_ref), from_ref: binding.dataset_ref, to_ref: binding.target_widget_ref, transform_ref: "dashboard.binding", ai_suggestion_ref: "", ai_decision: "not_applicable" as const, template_ref: dashboard.template_ref, dataset_binding_ref: binding.binding_id, version_diff_ref: "" })),
    ...(version.parent_version_id ? [{ edge_id: id("edge", version.parent_version_id, version.version_id), from_ref: version.parent_version_id, to_ref: version.version_id, transform_ref: "dashboard.version", ai_suggestion_ref: "", ai_decision: "not_applicable" as const, template_ref: dashboard.template_ref, dataset_binding_ref: "", version_diff_ref: "" }] : [])
  ];
  return { dashboard, version, dashboardArtifact, versionArtifact, canonical, versionCanonical, job, evidencePack, auditEvents, lineageEdges };
};

export class DashboardEngine {
  private readonly store: DashboardEngineStore;

  constructor(options: DashboardEngineOptions = {}) {
    this.store = new DashboardEngineStore(options.storageDir);
  }

  private persistWorkflow(result: DashboardWorkflowResult, actorRef: string): DashboardWorkflowResult {
    const persisted = this.store.persistWorkflow(result);
    this.upsertRefreshSchedule(persisted.dashboard, persisted.version, actorRef, persisted.dashboard.updated_at);
    return persisted;
  }

  private upsertRefreshSchedule(
    dashboard: Dashboard,
    version: DashboardVersion,
    actorRef: string,
    timestamp: string,
    overrides: Partial<Pick<ScheduledRefreshEntry, "due_at" | "refresh_binding_refs" | "status" | "error_message">> = {}
  ): ScheduledRefreshEntry | null {
    const nextDueAt = overrides.due_at ?? nextScheduleAt(dashboard, timestamp);
    if (!nextDueAt) {
      return null;
    }
    const existing = this.store.loadSchedule(dashboard.dashboard_id);
    return this.store.saveSchedule({
      schedule_id: existing?.schedule_id ?? id("scheduled-refresh", dashboard.dashboard_id),
      dashboard_id: dashboard.dashboard_id,
      dashboard_ref: dashboard.dashboard_id,
      version_ref: version.version_id,
      actor_ref: actorRef,
      refresh_binding_refs: overrides.refresh_binding_refs ?? existing?.refresh_binding_refs ?? [],
      schedule_kind: dashboard.refresh_policy.schedule_kind,
      schedule_ref: dashboard.refresh_policy.schedule_ref,
      stale_after_minutes: dashboard.refresh_policy.stale_after_minutes,
      due_at: nextDueAt,
      next_due_at: nextDueAt,
      status: overrides.status ?? "scheduled",
      last_run_at: dashboard.refresh_policy.last_refresh_at ?? existing?.last_run_at ?? null,
      last_job_ref: version.refresh_job_ref ?? existing?.last_job_ref ?? null,
      last_runner_job_ref: existing?.last_runner_job_ref ?? null,
      updated_at: timestamp,
      error_message: overrides.error_message ?? null
    });
  }

  getStorageRoot(): string {
    return this.store.rootDir;
  }

  loadPersistedDashboardState(dashboardId: string): PersistedDashboardState {
    return this.store.loadDashboardState(dashboardId);
  }

  listScheduledRefreshes(): ScheduledRefreshEntry[] {
    return this.store.listSchedules();
  }

  listScheduleRunnerJobs(dashboardId: string): ScheduledRefreshRunnerJob[] {
    return this.store.listRunnerJobs(dashboardId);
  }

  scheduleDashboardRefresh(input: ScheduleDashboardRefreshRequest): ScheduledRefreshEntry {
    const request = ScheduleDashboardRefreshRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const persisted = this.store.loadDashboardState(request.dashboard_id);
    return this.upsertRefreshSchedule(
      persisted.dashboard,
      persisted.version,
      request.actor_ref ?? persisted.version.created_by,
      timestamp,
      {
        due_at: request.due_at ?? timestamp,
        refresh_binding_refs: request.refresh_binding_refs ?? []
      }
    ) as ScheduledRefreshEntry;
  }

  runDueRefreshes(runAt?: string): DashboardWorkflowResult[] {
    const timestamp = now(runAt);
    return this.store.listDueSchedules(timestamp).map((schedule) => {
      const queuedRunner = this.store.saveRunnerJob({
        runner_job_id: id("runner-job", schedule.dashboard_id, timestamp),
        schedule_id: schedule.schedule_id,
        dashboard_id: schedule.dashboard_id,
        dashboard_version_ref: schedule.version_ref,
        refresh_job_ref: null,
        evidence_ref: null,
        due_at: schedule.due_at,
        queued_at: timestamp,
        started_at: null,
        finished_at: null,
        state: "queued",
        output_version_ref: null,
        error_message: null
      });
      this.store.saveSchedule({
        ...schedule,
        status: "running",
        last_runner_job_ref: queuedRunner.runner_job_id,
        updated_at: timestamp,
        error_message: null
      });
      const runningRunner = this.store.saveRunnerJob({
        ...queuedRunner,
        state: "running",
        started_at: timestamp
      });
      try {
        const persisted = this.store.loadDashboardState(schedule.dashboard_id);
        const refreshed = this.refreshDashboard({
          dashboard: persisted.dashboard,
          base_version: persisted.version,
          actor_ref: schedule.actor_ref,
          refresh_binding_refs: schedule.refresh_binding_refs.length > 0 ? schedule.refresh_binding_refs : undefined,
          timestamp
        });
        this.store.saveRunnerJob({
          ...runningRunner,
          state: "completed",
          finished_at: timestamp,
          refresh_job_ref: refreshed.job.job_id,
          evidence_ref: refreshed.evidencePack.evidence_pack_id,
          output_version_ref: refreshed.version.version_id
        });
        const rescheduled = this.store.loadSchedule(schedule.dashboard_id);
        if (rescheduled) {
          this.store.saveSchedule({
            ...rescheduled,
            last_run_at: timestamp,
            last_job_ref: refreshed.job.job_id,
            last_runner_job_ref: runningRunner.runner_job_id,
            updated_at: timestamp,
            error_message: null
          });
        }
        return refreshed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.store.saveRunnerJob({
          ...runningRunner,
          state: "failed",
          finished_at: timestamp,
          error_message: message
        });
        this.store.saveSchedule({
          ...schedule,
          status: "failed",
          last_runner_job_ref: runningRunner.runner_job_id,
          updated_at: timestamp,
          error_message: message
        });
        throw error;
      }
    });
  }

  private buildPublicationTransport(
    dashboard: Dashboard,
    version: DashboardVersion,
    publicationId: string,
    requestedTargetRef: string,
    timestamp: string
  ): DashboardPublicationTransport {
    const access = accessMode(dashboard.permission_scope);
    const backendRef = `backend://dashboard-engine/publications/${publicationId}`;
    const manifest = this.store.writePublicationTransportJson(dashboard.dashboard_id, publicationId, "manifest.json", {
      backend_ref: backendRef,
      publication_id: publicationId,
      dashboard_id: dashboard.dashboard_id,
      version_id: version.version_id,
      artifact_ref: version.snapshot_artifact_ref,
      requested_target_ref: requestedTargetRef,
      permission_scope: dashboard.permission_scope,
      access_mode: access,
      published_at: timestamp
    });
    const publishState = this.store.writePublicationTransportJson(dashboard.dashboard_id, publicationId, "publish-state.json", {
      backend_ref: backendRef,
      publication_id: publicationId,
      dashboard_id: dashboard.dashboard_id,
      version_id: version.version_id,
      publication_state: dashboard.publication_metadata.publication_state,
      embed_enabled: dashboard.publication_metadata.embed_enabled,
      visibility_scope: dashboard.publication_metadata.visibility_scope,
      access_mode: access,
      allow_read: dashboard.permission_scope.allow_read,
      allow_write: dashboard.permission_scope.allow_write,
      allow_share: dashboard.permission_scope.allow_share,
      allow_publish: dashboard.permission_scope.allow_publish,
      allow_audit_view: dashboard.permission_scope.allow_audit_view
    });
    const embedPayload =
      dashboard.publication_metadata.embed_enabled
        ? this.store.writePublicationTransportJson(dashboard.dashboard_id, publicationId, "embed-payload.json", {
            backend_ref: backendRef,
            publication_id: publicationId,
            dashboard_id: dashboard.dashboard_id,
            version_id: version.version_id,
            title: dashboard.title,
            description: dashboard.description,
            widgets: dashboard.widgets.map((widget) => ({
              widget_id: widget.widget_id,
              widget_type: widget.widget_type,
              title: widget.title,
              subtitle: widget.subtitle,
              layout_item_ref: widget.layout_item_ref,
              binding_refs: widget.binding_refs,
              style_config: widget.style_config,
              editable: dashboard.permission_scope.allow_write && widget.editable
            })),
            layout_items: dashboard.layout_items,
            filter_sets: dashboard.filter_sets,
            bindings: dashboard.bindings.map((binding) => ({
              binding_id: binding.binding_id,
              dataset_ref: binding.dataset_ref,
              query_ref: binding.query_ref,
              target_widget_ref: binding.target_widget_ref,
              refresh_state: binding.refresh_state,
              last_refresh_at: binding.last_refresh_at
            })),
            permission_scope: dashboard.permission_scope,
            access_mode: access
          })
        : null;
    const embedHtml =
      embedPayload
        ? this.store.writePublicationTransportText(
            dashboard.dashboard_id,
            publicationId,
            "embed.html",
`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${dashboard.title}</title><style>body{font-family:"Amiri","Noto Naskh Arabic",Tahoma,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}.shell{max-width:1320px;margin:0 auto}.hero,.toolbar,.panel,.grid article{background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:16px;box-shadow:0 12px 32px rgba(15,23,42,.08)}.hero,.toolbar,.panel{margin-bottom:14px}.toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.meta{color:#475569;font-size:.9rem;margin-top:6px}.payload{white-space:pre-wrap;font-family:"Amiri","Noto Naskh Arabic",Tahoma,Arial,sans-serif;font-size:.96rem;line-height:1.9;direction:rtl;unicode-bidi:plaintext;text-align:justify;text-align-last:start;text-justify:inter-word;word-spacing:.06em}.trace{white-space:pre-wrap;font-family:Consolas,"Courier New",monospace;font-size:.86rem;line-height:1.6;max-height:320px;overflow:auto}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.chip{padding:6px 10px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc}.status{font-weight:700;font-size:1rem}.panel-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px}.chart-proof{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:10px}.chart-proof h3{margin:0 0 8px;font-size:.95rem}.chart-proof ul{margin:0;padding-inline-start:18px}.chart-proof li{margin-bottom:4px}input,button{border:1px solid #cbd5e1;border-radius:14px;padding:10px 12px;font:inherit}button{background:#fff9ef;cursor:pointer;font-weight:700}@media (max-width: 900px){.panel-grid{grid-template-columns:1fr}}</style></head><body><div class="shell"><section class="hero"><h1 data-dashboard-publication="${publicationId}">${dashboard.title}</h1><div class="meta" id="meta">publication=${publicationId} | access=${access} | version=${version.version_id}</div><div class="chips" id="filter-chips"></div></section><section class="toolbar"><input id="field" placeholder="field" /><input id="values" placeholder="Open,Sales" /><button id="run-filter">Filter</button><button id="run-selection">Selection</button><button id="run-drill">Drill</button><button id="run-refresh">Refresh</button><button id="run-compare">Compare</button></section><section class="panel-grid"><section class="panel"><div class="status" id="status">loading...</div><section class="grid" id="widgets"></section></section><aside class="panel"><div class="trace" id="compare"></div><div class="trace" id="trace"></div></aside></section><script type="application/json" id="dashboard-embed">${JSON.stringify({
              backend_ref: backendRef,
              publication_id: publicationId,
              base_url: `http://${DASHBOARD_TRANSPORT_HOST}:\${location.port || "${dashboardTransportPort}"}/publications/${publicationId}`,
              embed_payload_uri: embedPayload.uri,
              access_mode: access
})}</script><script>(function(){const config=JSON.parse(document.getElementById("dashboard-embed").textContent);const token=new URL(location.href).searchParams.get("access_token");const endpoint=(suffix)=>"/publications/"+config.publication_id+"/"+suffix+"?access_token="+encodeURIComponent(token||"");const api=async(suffix,method,body)=>{const response=await fetch(endpoint(suffix),{method:method||"GET",headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});return response.json();};const renderList=(title,items)=>items&&items.length?'<div class=\"chart-proof\"><h3>'+title+'</h3><ul>'+items.map((item)=>'<li>'+(item.text||item.title||item)+'</li>').join('')+'</ul></div>':'';const payloadStyle='direction:rtl;unicode-bidi:plaintext;text-align:justify;text-align-last:start;text-justify:inter-word;font-family:&quot;Amiri&quot;,&quot;Noto Naskh Arabic&quot;,Tahoma,Arial,sans-serif;line-height:1.9;word-spacing:.06em';const draw=(payload)=>{document.getElementById("status").textContent=(payload.dashboard?.title||"dashboard")+" | v"+(payload.version?.version_number||"?")+" | access="+payload.access_mode;document.getElementById("meta").textContent="publication="+payload.publication_id+" | published-version="+payload.manifest.version_id+" | current-version="+payload.version.version_id+" | access="+payload.access_mode;document.getElementById("field").value=document.getElementById("field").value||payload.filter_sets?.[0]?.field_ref||"";document.getElementById("filter-chips").innerHTML=(payload.filter_sets||[]).map((filter)=>'<span class=\"chip\">'+filter.title+': '+(filter.current_values?.join(\",\")||\"all\")+'</span>').join('');document.getElementById("widgets").innerHTML=(payload.widgets||[]).map((widget)=>{const chart=widget.style_config?.chart_localization||{};const interactive=widget.style_config?.interactive_localization||{};return '<article data-widget-ref=\"'+widget.widget_id+'\"><strong>'+widget.title+'</strong><div class=\"meta\">'+widget.widget_type+' | '+widget.page_id+'</div>'+renderList('المحاور',chart.axis_labels)+renderList('السلاسل',chart.series_labels)+renderList('التلميحات',chart.tooltip_labels)+renderList('وسيلة الإيضاح',chart.legend_labels)+renderList('عناصر التحكم',interactive.controls)+renderList('نصوص الواجهة',interactive.ui_strings)+'<div class=\"payload\" data-kashida=\"enabled\" style=\"'+payloadStyle+'\">'+JSON.stringify({query_ref:widget.query_ref,binding_refs:widget.binding_refs,style_config:widget.style_config},null,2)+'</div></article>';}).join('');document.getElementById("compare").textContent=JSON.stringify((payload.compare_results||[]).slice(-1)[0]||null,null,2);document.getElementById("trace").textContent=JSON.stringify({evidence:(payload.evidence||[]).map((entry)=>entry.evidence_pack_id),audit:(payload.audit||[]).map((entry)=>entry.event_id),lineage:(payload.lineage||[]).map((entry)=>entry.edge_id)},null,2);};const run=async(kind)=>{const payload=await api(kind==='filter'||kind==='selection'||kind==='drill'?'interactions/'+kind:kind==='refresh'?'interactions/refresh':'interactions/compare','POST',{field_ref:document.getElementById('field').value,values:document.getElementById('values').value.split(',').map((value)=>value.trim()).filter(Boolean),run_refresh:kind==='filter'});draw(payload.snapshot);document.getElementById('trace').textContent=JSON.stringify({emitted:payload.emitted_refs,latest:JSON.parse(document.getElementById('trace').textContent||'{}')},null,2);};document.getElementById('run-filter').onclick=()=>run('filter');document.getElementById('run-selection').onclick=()=>run('selection');document.getElementById('run-drill').onclick=()=>run('drill');document.getElementById('run-refresh').onclick=()=>run('refresh');document.getElementById('run-compare').onclick=()=>run('compare');api('runtime-state').then(draw);})();</script></div></body></html>`
          )
        : null;
    const served = registerServedPublicationRoute(
      this.store,
      publicationId,
      manifest.filePath,
      publishState.filePath,
      embedPayload?.filePath ?? null,
      embedHtml?.filePath ?? null
    );
    return {
      backend_ref: backendRef,
      manifest_path: manifest.filePath,
      manifest_uri: manifest.uri,
      requested_target_ref: requestedTargetRef,
      publish_state_path: publishState.filePath,
      publish_state_uri: publishState.uri,
      embed_payload_path: embedPayload?.filePath ?? null,
      embed_payload_uri: embedPayload?.uri ?? null,
      embed_html_path: embedHtml?.filePath ?? null,
      embed_html_uri: embedHtml?.uri ?? null,
      served_manifest_url: served.served_manifest_url,
      served_publish_state_url: served.served_publish_state_url,
      served_embed_payload_url: served.served_embed_payload_url,
      served_embed_html_url: served.served_embed_html_url,
      served_base_url: served.served_base_url,
      served_access_token: served.served_access_token,
      access_mode: access
    };
  }

  createDashboard(input: CreateDashboardRequest): DashboardWorkflowResult {
    const request = CreateDashboardRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const dashboardId = request.dashboard_id ?? id("dashboard", request.title, timestamp.slice(11, 19).replace(/:/g, ""));
    const blueprints = request.mode === "easy" && request.widget_blueprints.length === 0 ? autoBlueprints(request.dataset_profiles) : request.widget_blueprints;
    if (request.mode === "advanced" && blueprints.length === 0) throw new Error("Advanced mode requires explicit widget blueprints.");
    let pages: DashboardPage[] = ensurePage([], "page-overview");
    const widgets: DashboardWidget[] = [];
    const layoutItems: DashboardLayoutItem[] = [];
    const bindings: DashboardBinding[] = [];
    blueprints.forEach((blueprint, index) => {
      const built = buildWidget(blueprint, dashboardId, index, timestamp);
      pages = ensurePage(pages, built.widget.page_id);
      pages = attachWidgetToPage(pages, built.widget.page_id, built.widget.widget_id);
      widgets.push(built.widget);
      layoutItems.push(built.layout);
      if (built.binding) bindings.push(built.binding);
    });
    const permissionScope: PermissionScope = request.permission_scope;
    const tempDashboard = DashboardSchema.parse({
      contract: DASHBOARD_CONTRACT,
      ...Meta,
      dashboard_id: dashboardId,
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      artifact_ref: id("artifact", dashboardId, "current"),
      canonical_ref: id("canonical", dashboardId, "current"),
      current_version_ref: id("dashboard-version", dashboardId, 1),
      title: request.title,
      description: request.description,
      mode: request.mode,
      status: "draft",
      template_ref: request.template_ref,
      brand_preset_ref: request.brand_preset_ref,
      permission_scope: permissionScope,
      source_dataset_refs: request.dataset_profiles.map((profile) => profile.dataset_ref),
      pages,
      layout_items: layoutItems,
      widgets,
      bindings,
      filter_sets: [],
      interaction_rules: [],
      refresh_policy: DashboardRefreshPolicySchema.parse(request.refresh_policy ?? { ...Meta, policy_id: "refresh-policy-default", refresh_mode: "hybrid", schedule_kind: "daily", schedule_ref: "schedule://dashboards/daily-default", stale_after_minutes: 60, allow_selective_refresh: true, last_refresh_at: null }),
      publication_metadata: DashboardPublicationMetadataSchema.parse({ ...Meta, publication_state: "draft", visibility_scope: permissionScope.visibility, publication_refs: [], embed_enabled: false, preview_ref: id("preview", dashboardId, "draft"), library_asset_refs: [], last_published_version_ref: "" }),
      version_refs: [id("dashboard-version", dashboardId, 1)],
      compare_refs: [],
      editability: { ...Meta, allow_widget_add_remove: true, allow_widget_resize: true, allow_rebind: true, soft_lock_refs: [], hard_lock_refs: [] },
      created_at: timestamp,
      updated_at: timestamp
    });
    const filters = request.filters.length > 0 ? request.filters.map((filter, index) => DashboardFilterSetSchema.parse({ ...Meta, ...filter, filter_id: id("filter", dashboardId, index) })) : request.dataset_profiles.map((profile, index) => {
      const field = profile.available_filter_fields[0] ?? profile.dimension_fields[0];
      return field ? DashboardFilterSetSchema.parse({ ...Meta, filter_id: id("filter", dashboardId, index), filter_scope: "global", title: `${profile.display_name} ${field}`, control_type: "multi_select", dataset_ref: profile.dataset_ref, field_ref: field, default_values: [], current_values: [], target_widget_refs: bindings.filter((binding) => binding.dataset_ref === profile.dataset_ref).map((binding) => binding.target_widget_ref) }) : null;
    }).filter((item): item is DashboardFilterSet => item !== null);
    const dashboard = DashboardSchema.parse({ ...tempDashboard, filter_sets: filters, pages: tempDashboard.pages.map((page) => DashboardPageSchema.parse({ ...page, filter_refs: page.default_page ? filters.map((filter) => filter.filter_id) : page.filter_refs })) });
    const version = createVersion(dashboard, 1, null, request.created_by, "Initial dashboard creation", "create", timestamp);
    return this.persistWorkflow(
      buildWorkflow(dashboard, version, request.dataset_profiles, "dashboard.create.v1", "dashboard_create", timestamp, request.created_by),
      request.created_by
    );
  }

  updateDashboard(input: UpdateDashboardRequest): DashboardWorkflowResult {
    const request = UpdateDashboardRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const dashboard = clone(request.dashboard);
    const mutation = request.mutation;
    if (mutation.mutation_kind === "add_widget") {
      const built = buildWidget(mutation.widget, dashboard.dashboard_id, dashboard.widgets.length, timestamp);
      dashboard.pages = attachWidgetToPage(ensurePage(dashboard.pages, built.widget.page_id), built.widget.page_id, built.widget.widget_id);
      dashboard.widgets.push(built.widget);
      dashboard.layout_items.push(built.layout);
      if (built.binding) dashboard.bindings.push(built.binding);
    } else if (mutation.mutation_kind === "add_page") {
      dashboard.pages = ensurePage(
        [
          ...dashboard.pages,
          DashboardPageSchema.parse({
            ...Meta,
            page_id: mutation.page_id,
            title: mutation.title,
            tab_order: dashboard.pages.length,
            default_page: dashboard.pages.length === 0,
            layout_grid: DashboardGridDefinitionSchema.parse({ ...Meta, columns: 12, row_height: 120, gap: 1 }),
            widget_refs: [],
            filter_refs: []
          })
        ],
        mutation.page_id
      );
    } else if (mutation.mutation_kind === "remove_widget") {
      const widget = dashboard.widgets.find((item) => item.widget_id === mutation.widget_ref);
      if (!widget) throw new Error(`Unknown widget ${mutation.widget_ref}`);
      dashboard.widgets = dashboard.widgets.filter((item) => item.widget_id !== widget.widget_id);
      dashboard.layout_items = dashboard.layout_items.filter((item) => item.item_id !== widget.layout_item_ref);
      dashboard.bindings = dashboard.bindings.filter((binding) => !widget.binding_refs.includes(binding.binding_id));
      dashboard.pages = dashboard.pages.map((page) => DashboardPageSchema.parse({ ...page, widget_refs: page.widget_refs.filter((ref) => ref !== widget.widget_id) }));
    } else if (mutation.mutation_kind === "move_widget" || mutation.mutation_kind === "resize_widget") {
      const widget = dashboard.widgets.find((item) => item.widget_id === mutation.widget_ref);
      if (!widget) throw new Error(`Unknown widget ${mutation.widget_ref}`);
      const targetPageId = "page_id" in mutation.layout ? mutation.layout.page_id : undefined;
      dashboard.layout_items = dashboard.layout_items.map((item) => item.item_id === widget.layout_item_ref ? DashboardLayoutItemSchema.parse({ ...item, page_id: targetPageId ?? item.page_id, x: mutation.layout.x ?? item.x, y: mutation.layout.y ?? item.y, width: mutation.layout.width ?? item.width, height: mutation.layout.height ?? item.height }) : item);
    } else if (mutation.mutation_kind === "rebind_widget") {
      const widget = dashboard.widgets.find((item) => item.widget_id === mutation.widget_ref);
      if (!widget) throw new Error(`Unknown widget ${mutation.widget_ref}`);
      const bindingId = id("binding", mutation.binding.dataset_ref, widget.widget_id);
      dashboard.bindings = [...dashboard.bindings.filter((binding) => binding.target_widget_ref !== widget.widget_id), DashboardBindingSchema.parse({ ...Meta, binding_id: bindingId, dataset_ref: mutation.binding.dataset_ref, query_ref: mutation.binding.query_ref ?? `${mutation.binding.dataset_ref}:default`, target_widget_ref: widget.widget_id, field_mappings: mutation.binding.field_mappings, calculation_refs: mutation.binding.calculation_refs, refresh_state: "fresh", last_refresh_at: timestamp, warning_codes: [] })];
      dashboard.widgets = dashboard.widgets.map((item) => item.widget_id === widget.widget_id ? DashboardWidgetSchema.parse({ ...item, binding_refs: [bindingId] }) : item);
    } else if (mutation.mutation_kind === "update_widget_config") {
      const widget = dashboard.widgets.find((item) => item.widget_id === mutation.widget_ref);
      if (!widget) throw new Error(`Unknown widget ${mutation.widget_ref}`);
      dashboard.widgets = dashboard.widgets.map((item) =>
        item.widget_id === widget.widget_id
          ? DashboardWidgetSchema.parse({
              ...item,
              page_id: mutation.page_id ?? item.page_id,
              title: mutation.title ?? item.title,
              subtitle: mutation.subtitle ?? item.subtitle,
              style_config: mutation.style_config ? { ...item.style_config, ...mutation.style_config } : item.style_config,
              interaction_refs: mutation.interaction_refs ?? item.interaction_refs,
              editable: mutation.editable ?? item.editable
            })
          : item
      );
      if (mutation.page_id && mutation.page_id !== widget.page_id) {
        dashboard.pages = dashboard.pages.map((page) =>
          DashboardPageSchema.parse({
            ...page,
            widget_refs:
              page.page_id === widget.page_id
                ? page.widget_refs.filter((ref) => ref !== widget.widget_id)
                : page.page_id === mutation.page_id
                  ? [...new Set([...page.widget_refs, widget.widget_id])]
                  : page.widget_refs
          })
        );
        dashboard.layout_items = dashboard.layout_items.map((item) =>
          item.item_id === widget.layout_item_ref ? DashboardLayoutItemSchema.parse({ ...item, page_id: mutation.page_id }) : item
        );
      }
    } else if (mutation.mutation_kind === "duplicate_widget") {
      const widget = dashboard.widgets.find((item) => item.widget_id === mutation.widget_ref);
      const layout = widget ? dashboard.layout_items.find((item) => item.item_id === widget.layout_item_ref) : null;
      const binding = widget ? dashboard.bindings.find((item) => item.target_widget_ref === widget.widget_id) : null;
      if (!widget || !layout) throw new Error(`Unknown widget ${mutation.widget_ref}`);
      const built = buildWidget({ widget_type: widget.widget_type, title: `${widget.title} Copy`, subtitle: widget.subtitle, page_id: mutation.target_page_id ?? widget.page_id, layout: { page_id: mutation.target_page_id ?? widget.page_id, x: layout.x + 1, y: layout.y + 1, width: layout.width, height: layout.height }, binding: binding ? { dataset_ref: binding.dataset_ref, query_ref: binding.query_ref, field_mappings: binding.field_mappings, calculation_refs: binding.calculation_refs } : undefined, style_config: widget.style_config, interaction_refs: widget.interaction_refs, editable: widget.editable, warning_codes: widget.warning_codes }, dashboard.dashboard_id, dashboard.widgets.length, timestamp);
      dashboard.pages = attachWidgetToPage(ensurePage(dashboard.pages, built.widget.page_id), built.widget.page_id, built.widget.widget_id);
      dashboard.widgets.push(built.widget);
      dashboard.layout_items.push(built.layout);
      if (built.binding) dashboard.bindings.push(built.binding);
    } else {
      const filterId = mutation.filter_id ?? id("filter", dashboard.dashboard_id, dashboard.filter_sets.length);
      const filter = DashboardFilterSetSchema.parse({ ...Meta, ...mutation.filter, filter_id: filterId });
      dashboard.filter_sets = [...dashboard.filter_sets.filter((item) => item.filter_id !== filterId), filter];
      dashboard.pages = dashboard.pages.map((page) => DashboardPageSchema.parse({ ...page, filter_refs: filter.filter_scope === "global" && !page.filter_refs.includes(filterId) ? [...page.filter_refs, filterId] : page.filter_refs }));
    }
    dashboard.updated_at = timestamp;
    dashboard.status = "active";
    dashboard.publication_metadata = DashboardPublicationMetadataSchema.parse({ ...dashboard.publication_metadata, publication_state: "ready" });
    const version = createVersion(DashboardSchema.parse(dashboard), request.base_version.version_number + 1, request.base_version.version_id, request.actor_ref, `Dashboard mutation: ${mutation.mutation_kind}`, "manual_edit", timestamp);
    dashboard.current_version_ref = version.version_id;
    dashboard.canonical_ref = id("canonical", dashboard.dashboard_id, "current", version.version_id);
    dashboard.version_refs = [...dashboard.version_refs, version.version_id];
    const profiles = dashboard.source_dataset_refs.map((dataset_ref) => ({ dataset_ref, display_name: dataset_ref, dimension_fields: [], measure_fields: [], available_filter_fields: [] }));
    return this.persistWorkflow(
      buildWorkflow(
        DashboardSchema.parse(dashboard),
        version,
        profiles,
        "dashboard.mutate.v1",
        "dashboard_mutation",
        timestamp,
        request.actor_ref
      ),
      request.actor_ref
    );
  }

  refreshDashboard(input: RefreshDashboardRequest): DashboardWorkflowResult {
    const request = RefreshDashboardRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const dashboard = clone(request.dashboard);
    const targets = request.refresh_binding_refs ?? dashboard.bindings.map((binding) => binding.binding_id);
    dashboard.bindings = dashboard.bindings.map((binding) =>
      targets.includes(binding.binding_id)
        ? DashboardBindingSchema.parse({ ...binding, refresh_state: "fresh", last_refresh_at: timestamp, warning_codes: [] })
        : binding
    );
    dashboard.refresh_policy = DashboardRefreshPolicySchema.parse({ ...dashboard.refresh_policy, last_refresh_at: timestamp });
    dashboard.updated_at = timestamp;
    dashboard.status = "active";
    dashboard.publication_metadata = DashboardPublicationMetadataSchema.parse({ ...dashboard.publication_metadata, publication_state: "ready" });
    const version = createVersion(DashboardSchema.parse(dashboard), request.base_version.version_number + 1, request.base_version.version_id, request.actor_ref, "Dashboard refresh", "refresh", timestamp);
    version.refresh_job_ref = id("job", dashboard.dashboard_id, version.version_id, "dashboard_refresh");
    dashboard.current_version_ref = version.version_id;
    dashboard.canonical_ref = id("canonical", dashboard.dashboard_id, "current", version.version_id);
    dashboard.version_refs = [...dashboard.version_refs, version.version_id];
    const profiles = dashboard.source_dataset_refs.map((dataset_ref) => ({ dataset_ref, display_name: dataset_ref, dimension_fields: [], measure_fields: [], available_filter_fields: [] }));
    return this.persistWorkflow(
      buildWorkflow(
        DashboardSchema.parse(dashboard),
        DashboardVersionSchema.parse(version),
        profiles,
        "dashboard.refresh.v1",
        "dashboard_refresh",
        timestamp,
        request.actor_ref
      ),
      request.actor_ref
    );
  }

  publishDashboard(input: PublishDashboardRequest): DashboardPublicationResult {
    const request = PublishDashboardRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const permissionScope = request.permission_scope ?? request.dashboard.permission_scope;
    const publicationKey = request.publication_key ?? "publish";
    const publicationId = id("publication", request.dashboard.dashboard_id, request.version.version_id, publicationKey);
    const publicationActionRef = publicationKey === "share" ? "dashboard.share.v1" : "dashboard.publish.v1";
    const publicationTransformRef = publicationKey === "share" ? "dashboard.share" : "dashboard.publish";
    const dashboard = DashboardSchema.parse({
      ...clone(request.dashboard),
      status: "published",
      updated_at: timestamp,
      permission_scope: permissionScope,
      publication_metadata: DashboardPublicationMetadataSchema.parse({
        ...request.dashboard.publication_metadata,
        publication_state: "published",
        visibility_scope: permissionScope.visibility,
        publication_refs: [...request.dashboard.publication_metadata.publication_refs, publicationId],
        embed_enabled: request.embeddable,
        preview_ref: id("preview", request.dashboard.dashboard_id, request.version.version_id, publicationKey),
        last_published_version_ref: request.version.version_id
      })
    });
    const version = DashboardVersionSchema.parse({ ...clone(request.version), publication_state: "published" });
    const transport = this.buildPublicationTransport(dashboard, version, publicationId, request.target_ref, timestamp);
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: publicationId,
      artifact_ref: version.snapshot_artifact_ref,
      publication_type: "internal_publish",
      editable_default: permissionScope.allow_write,
      explicit_non_editable_export: false,
      target_ref: transport.served_embed_html_url ?? transport.served_manifest_url,
      published_by: request.published_by,
      published_at: timestamp,
      permission_scope: permissionScope,
      evidence_ref: id("evidence", dashboard.dashboard_id, version.version_id, publicationKey)
    });
    const libraryAsset = request.publish_to_library
      ? LibraryAssetSchema.parse({
          contract: contractEnvelope("library"),
          asset_id: id("library", dashboard.dashboard_id, version.version_id),
          asset_type: "dashboard",
          source: publication.publication_id,
          tags: ["dashboard", dashboard.mode, "published"],
          version: version.semantic_version,
          tenant_scope: "workspace",
          permission_scope: permissionScope,
          reuse_policy: "free",
          dependency_refs: dashboard.source_dataset_refs,
          created_at: timestamp,
          updated_at: timestamp
        })
      : null;
    if (libraryAsset) dashboard.publication_metadata.library_asset_refs = [...dashboard.publication_metadata.library_asset_refs, libraryAsset.asset_id];
    const evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", dashboard.dashboard_id, version.version_id, publicationKey),
      verification_status: "verified",
      source_refs: dashboard.source_dataset_refs,
      generated_artifact_refs: [publication.publication_id, version.snapshot_artifact_ref],
      checks_executed: [{ check_id: id("check", dashboard.dashboard_id, publicationKey, "publication"), check_name: "publication_ready_check", check_type: "publication", passed: true, severity: "medium", details: "Dashboard publication payload was generated.", impacted_refs: [publication.publication_id] }],
      before_refs: [version.version_id],
      after_refs: [publication.publication_id],
      metrics: [{ metric_name: "publication_count", metric_value: 1, metric_unit: "publications" }],
      warnings: [],
      failure_reasons: [],
      degraded_reasons: [],
      replay_context: { action_id: publicationActionRef, dashboard_id: dashboard.dashboard_id },
      reproducibility_metadata: { replay_token: id("replay", dashboard.dashboard_id, version.version_id, publicationKey), execution_seed: `${dashboard.dashboard_id}:${version.version_id}:${publicationKey}`, environment_stamp: "rasid-platform-core", tool_versions: [{ tool: "dashboard-engine", version: "1.0.0" }] },
      strict_evidence_level: "standard"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", dashboard.dashboard_id, version.version_id, `dashboard_${publicationKey}`),
      capability: "dashboards",
      requested_mode: dashboard.mode,
      capability_submode: `dashboard_${publicationKey}`,
      source_refs: dashboard.source_dataset_refs,
      artifact_refs: [version.snapshot_artifact_ref],
      progress: 100,
      stage: "dashboard_publish",
      state: "completed",
      warnings: [],
      failure_reason: null,
      retry_policy: { max_attempts: 2, strategy: "fixed", backoff_ms: 500 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: timestamp,
      finished_at: timestamp,
      resource_profile: { cpu_class: "standard", memory_class: "small", io_class: "balanced", expected_parallelism: 1 }
    });
    const auditEvents = [
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", dashboard.dashboard_id, publicationActionRef, timestamp),
        timestamp,
        actor_ref: request.published_by,
        actor_type: "service",
        action_ref: publicationActionRef,
        job_ref: job.job_id,
        object_refs: [dashboard.dashboard_id, publication.publication_id, version.version_id],
        workspace_id: dashboard.workspace_id,
        tenant_ref: dashboard.tenant_ref,
        metadata: {
          requested_target_ref: request.target_ref,
          resolved_target_ref: publication.target_ref,
          manifest_uri: transport.manifest_uri,
          embed_payload_uri: transport.embed_payload_uri,
          embed_html_uri: transport.embed_html_uri,
          served_manifest_url: transport.served_manifest_url,
          served_embed_payload_url: transport.served_embed_payload_url,
          served_embed_html_url: transport.served_embed_html_url,
          embeddable: request.embeddable
        }
      })
    ];
    const lineageEdges: LineageEdge[] = [
      { edge_id: id("edge", version.snapshot_artifact_ref, publication.publication_id), from_ref: version.snapshot_artifact_ref, to_ref: publication.publication_id, transform_ref: publicationTransformRef, ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: dashboard.template_ref, dataset_binding_ref: "", version_diff_ref: "" }
    ];
    return this.store.persistPublication({ dashboard, version, publication, libraryAsset, transport, job, evidencePack, auditEvents, lineageEdges });
  }

  executeInteraction(input: ExecuteDashboardInteractionRequest): DashboardInteractionExecutionResult {
    const request = ExecuteDashboardInteractionRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const dashboard = clone(request.dashboard);
    const targetWidgetRefs =
      request.target_widget_refs.length > 0
        ? request.target_widget_refs
        : dashboard.widgets.filter((widget) => widget.widget_id !== request.source_widget_ref).map((widget) => widget.widget_id);
    const interactionRule = DashboardInteractionRuleSchema.parse({
      ...Meta,
      rule_id: id("interaction-rule", dashboard.dashboard_id, request.source_widget_ref, request.trigger, timestamp),
      source_widget_ref: request.source_widget_ref,
      trigger: request.trigger,
      target_widget_refs: targetWidgetRefs,
      effect: request.effect,
      payload: request.payload,
      enabled: true
    });
    dashboard.interaction_rules = [
      ...dashboard.interaction_rules.filter((rule) => rule.rule_id !== interactionRule.rule_id),
      interactionRule
    ];
    if (request.effect === "filter") {
      const datasetRef = String(request.payload.dataset_ref ?? dashboard.source_dataset_refs[0] ?? "dataset");
      const fieldRef = String(request.payload.field_ref ?? "selection");
      const filterId = String(request.payload.filter_id ?? id("filter", dashboard.dashboard_id, datasetRef, fieldRef));
      const values = normalizeValues(request.payload.values ?? request.payload.selected_values);
      const filter = DashboardFilterSetSchema.parse({
        ...Meta,
        filter_id: filterId,
        filter_scope: "global",
        title: `${fieldRef} interaction filter`,
        control_type: "multi_select",
        dataset_ref: datasetRef,
        field_ref: fieldRef,
        default_values: [],
        current_values: values,
        target_widget_refs: targetWidgetRefs
      });
      dashboard.filter_sets = [...dashboard.filter_sets.filter((item) => item.filter_id !== filterId), filter];
      dashboard.pages = dashboard.pages.map((page) =>
        DashboardPageSchema.parse({
          ...page,
          filter_refs: page.filter_refs.includes(filterId) ? page.filter_refs : [...page.filter_refs, filterId]
        })
      );
      dashboard.bindings = dashboard.bindings.map((binding) =>
        targetWidgetRefs.includes(binding.target_widget_ref) && binding.dataset_ref === datasetRef
          ? DashboardBindingSchema.parse({
              ...binding,
              query_ref: `${binding.query_ref}|filter:${fieldRef}=${values.join(",")}`,
              refresh_state: "stale",
              warning_codes: ["filter_pending_refresh"]
            })
          : binding
      );
      dashboard.widgets = dashboard.widgets.map((widget) =>
        targetWidgetRefs.includes(widget.widget_id)
          ? DashboardWidgetSchema.parse({
              ...widget,
              style_config: {
                ...widget.style_config,
                interaction_filter: {
                  source_widget_ref: request.source_widget_ref,
                  filter_id: filterId,
                  values
                }
              }
            })
          : widget
      );
    } else if (request.effect === "highlight") {
      const selectedValues = normalizeValues(request.payload.selected_values ?? request.payload.values);
      dashboard.widgets = dashboard.widgets.map((widget) =>
        targetWidgetRefs.includes(widget.widget_id)
          ? DashboardWidgetSchema.parse({
              ...widget,
              style_config: {
                ...widget.style_config,
                interaction_selection: {
                  source_widget_ref: request.source_widget_ref,
                  selected_values: selectedValues,
                  trigger: request.trigger
                }
              }
            })
          : widget
      );
    } else if (request.effect === "navigate") {
      const destination = String(request.payload.destination_page_id ?? request.payload.destination_ref ?? "drill://detail");
      dashboard.widgets = dashboard.widgets.map((widget) =>
        widget.widget_id === request.source_widget_ref
          ? DashboardWidgetSchema.parse({
              ...widget,
              style_config: {
                ...widget.style_config,
                interaction_navigation: {
                  destination,
                  trigger: request.trigger,
                  context: request.payload
                }
              }
            })
          : widget
      );
    } else {
      const compareBaseVersionRef = String(request.payload.compare_base_version_ref ?? request.base_version.version_id);
      dashboard.widgets = dashboard.widgets.map((widget) =>
        targetWidgetRefs.includes(widget.widget_id)
          ? DashboardWidgetSchema.parse({
              ...widget,
              style_config: {
                ...widget.style_config,
                interaction_compare: {
                  source_widget_ref: request.source_widget_ref,
                  compare_base_version_ref: compareBaseVersionRef
                }
              }
            })
          : widget
      );
    }
    dashboard.updated_at = timestamp;
    dashboard.status = "active";
    dashboard.publication_metadata = DashboardPublicationMetadataSchema.parse({
      ...dashboard.publication_metadata,
      publication_state: "ready"
    });
    const version = createVersion(
      DashboardSchema.parse(dashboard),
      request.base_version.version_number + 1,
      request.base_version.version_id,
      request.actor_ref,
      `Dashboard interaction: ${request.trigger}/${request.effect}`,
      "manual_edit",
      timestamp
    );
    dashboard.current_version_ref = version.version_id;
    dashboard.canonical_ref = id("canonical", dashboard.dashboard_id, "current", version.version_id);
    dashboard.version_refs = [...dashboard.version_refs, version.version_id];
    const profiles = dashboard.source_dataset_refs.map((dataset_ref) => ({
      dataset_ref,
      display_name: dataset_ref,
      dimension_fields: [],
      measure_fields: [],
      available_filter_fields: []
    }));
    const workflow = this.persistWorkflow(
      buildWorkflow(
        DashboardSchema.parse(dashboard),
        version,
        profiles,
        dashboardInteractionActionId(request),
        "dashboard_interaction",
        timestamp,
        request.actor_ref
      ),
      request.actor_ref
    );
    const interactionBindingRefs = workflow.dashboard.bindings
      .filter((binding) => targetWidgetRefs.includes(binding.target_widget_ref))
      .map((binding) => binding.binding_id);
    const refreshResult =
      request.payload.run_refresh === true || request.payload.action === "refresh"
        ? this.refreshDashboard({
            dashboard: workflow.dashboard,
            base_version: workflow.version,
            actor_ref: request.actor_ref,
            refresh_binding_refs: interactionBindingRefs.length > 0 ? interactionBindingRefs : undefined,
            timestamp
          })
        : null;
    const compareBaseVersionRef = String(request.payload.compare_base_version_ref ?? request.base_version.version_id);
    const compareBundle =
      request.effect === "compare" || request.payload.action === "compare"
        ? (() => {
            const base = this.store.loadDashboardVersion(workflow.dashboard.dashboard_id, compareBaseVersionRef);
            const latestDashboard = refreshResult?.dashboard ?? workflow.dashboard;
            const latestVersion = refreshResult?.version ?? workflow.version;
            return this.compareDashboardVersions({
              dashboard_id: latestDashboard.dashboard_id,
              tenant_ref: latestDashboard.tenant_ref,
              workspace_id: latestDashboard.workspace_id,
              actor_ref: request.actor_ref,
              base_version: base.version,
              target_version: latestVersion,
              base_snapshot: base.dashboard,
              target_snapshot: latestDashboard,
              timestamp
            });
          })()
        : null;
    return { interactionRule, workflow, refreshResult, compareBundle };
  }

  compareDashboardVersions(input: CompareDashboardVersionsRequest): DashboardCompareBundle {
    const request = CompareDashboardVersionsRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const diff = <T extends Record<string, unknown>>(baseItems: T[], targetItems: T[], idKey: keyof T) => {
      const baseMap = new Map(baseItems.map((item) => [String(item[idKey]), item]));
      const targetMap = new Map(targetItems.map((item) => [String(item[idKey]), item]));
      const keys = [...new Set([...baseMap.keys(), ...targetMap.keys()])];
      return {
        changedRefs: keys.filter((key) => JSON.stringify(baseMap.get(key)) !== JSON.stringify(targetMap.get(key))),
        deltas: keys
          .filter((key) => JSON.stringify(baseMap.get(key)) !== JSON.stringify(targetMap.get(key)))
          .map((key) => ({
            ref: key,
            base: baseMap.get(key) ?? null,
            target: targetMap.get(key) ?? null
          }))
      };
    };
    const widgetDiff = diff(request.base_snapshot.widgets, request.target_snapshot.widgets, "widget_id");
    const layoutDiff = diff(request.base_snapshot.layout_items, request.target_snapshot.layout_items, "item_id");
    const filterDiff = diff(request.base_snapshot.filter_sets, request.target_snapshot.filter_sets, "filter_id");
    const bindingDiff = diff(request.base_snapshot.bindings, request.target_snapshot.bindings, "binding_id");
    const interactionDiff = diff(request.base_snapshot.interaction_rules, request.target_snapshot.interaction_rules, "rule_id");
    const changedWidgetRefs = widgetDiff.changedRefs;
    const changedLayoutRefs = layoutDiff.changedRefs;
    const changedFilterRefs = filterDiff.changedRefs;
    const versionDelta = {
      base_version_ref: request.base_version.version_id,
      target_version_ref: request.target_version.version_id,
      publication_state_changed: request.base_version.publication_state !== request.target_version.publication_state,
      stale_binding_delta: request.target_version.stale_binding_count - request.base_version.stale_binding_count,
      refresh_job_changed: request.base_version.refresh_job_ref !== request.target_version.refresh_job_ref
    };
    const refreshStateDiffs = bindingDiff.deltas.map((delta) => ({
      binding_ref: delta.ref,
      base_refresh_state: (delta.base as DashboardBinding | null)?.refresh_state ?? null,
      target_refresh_state: (delta.target as DashboardBinding | null)?.refresh_state ?? null,
      base_last_refresh_at: (delta.base as DashboardBinding | null)?.last_refresh_at ?? null,
      target_last_refresh_at: (delta.target as DashboardBinding | null)?.last_refresh_at ?? null
    }));
    const compareResult = DashboardCompareResultSchema.parse({
      contract: DASHBOARD_CONTRACT,
      ...Meta,
      compare_id: id("compare", request.dashboard_id, request.base_version.version_id, request.target_version.version_id),
      dashboard_ref: request.dashboard_id,
      base_version_ref: request.base_version.version_id,
      target_version_ref: request.target_version.version_id,
      changed_widget_refs: changedWidgetRefs,
      changed_layout_item_refs: changedLayoutRefs,
      changed_filter_refs: changedFilterRefs,
      widget_config_diffs: widgetDiff.deltas,
      layout_diffs: layoutDiff.deltas,
      filter_state_diffs: filterDiff.deltas,
      binding_diffs: bindingDiff.deltas,
      interaction_rule_diffs: interactionDiff.deltas,
      refresh_result_diffs: refreshStateDiffs,
      version_delta: versionDelta,
      data_source_delta: {
        added_dataset_refs: request.target_snapshot.source_dataset_refs.filter((item) => !request.base_snapshot.source_dataset_refs.includes(item)),
        removed_dataset_refs: request.base_snapshot.source_dataset_refs.filter((item) => !request.target_snapshot.source_dataset_refs.includes(item))
      },
      summary: `Compared ${request.base_version.semantic_version} to ${request.target_version.semantic_version}`,
      diff_artifact_ref: id("artifact", request.dashboard_id, request.base_version.version_id, request.target_version.version_id, "compare"),
      created_at: timestamp,
      created_by: request.actor_ref
    });
    const diffArtifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: compareResult.diff_artifact_ref,
      artifact_type: "dashboard",
      artifact_subtype: "version_compare",
      project_id: request.target_snapshot.project_id,
      workspace_id: request.workspace_id,
      source_refs: request.target_snapshot.source_dataset_refs,
      parent_artifact_refs: [request.base_version.snapshot_artifact_ref, request.target_version.snapshot_artifact_ref],
      canonical_ref: "",
      created_by: request.actor_ref,
      created_at: timestamp,
      mode: request.target_snapshot.mode,
      editable_status: "non_editable",
      template_status: request.target_snapshot.template_ref ? "applied" : "none",
      lineage_ref: id("lineage-compare", compareResult.compare_id),
      evidence_ref: id("evidence", compareResult.compare_id),
      verification_status: "verified",
      storage_ref: { storage_id: id("storage", compareResult.compare_id), storage_class: "object", uri: `memory://dashboards/${request.dashboard_id}/compare/${compareResult.compare_id}`, checksum: `sha256:${compareResult.compare_id}`, region: "workspace" },
      preview_ref: { preview_id: id("preview", compareResult.compare_id), preview_type: "html_canvas", storage_ref: id("storage", compareResult.compare_id) },
      export_refs: [],
      version_ref: { version_id: request.target_version.version_id, parent_version_id: request.base_version.version_id, version_number: request.target_version.version_number, semantic_version: request.target_version.semantic_version },
      tenant_ref: request.tenant_ref,
      permission_scope: request.target_snapshot.permission_scope
    });
    const evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", compareResult.compare_id),
      verification_status: "verified",
      source_refs: request.target_snapshot.source_dataset_refs,
      generated_artifact_refs: [diffArtifact.artifact_id],
      checks_executed: [{ check_id: id("check", compareResult.compare_id), check_name: "version_compare_check", check_type: "compare", passed: true, severity: "medium", details: "Dashboard version diff was generated.", impacted_refs: [diffArtifact.artifact_id] }],
      before_refs: [request.base_version.version_id],
      after_refs: [request.target_version.version_id],
      metrics: [
        { metric_name: "changed_widgets", metric_value: changedWidgetRefs.length, metric_unit: "widgets" },
        { metric_name: "changed_layout_items", metric_value: changedLayoutRefs.length, metric_unit: "layout_items" },
        { metric_name: "changed_filters", metric_value: changedFilterRefs.length, metric_unit: "filters" },
        { metric_name: "changed_bindings", metric_value: bindingDiff.changedRefs.length, metric_unit: "bindings" },
        { metric_name: "changed_interaction_rules", metric_value: interactionDiff.changedRefs.length, metric_unit: "rules" },
        { metric_name: "changed_refresh_states", metric_value: refreshStateDiffs.length, metric_unit: "binding_refresh_states" }
      ],
      warnings: [],
      failure_reasons: [],
      degraded_reasons: [],
      replay_context: { action_id: "dashboard.compare_versions.v1", dashboard_id: request.dashboard_id },
      reproducibility_metadata: { replay_token: id("replay", compareResult.compare_id), execution_seed: `${request.dashboard_id}:${request.base_version.version_id}:${request.target_version.version_id}`, environment_stamp: "rasid-platform-core", tool_versions: [{ tool: "dashboard-engine", version: "1.0.0" }] },
      strict_evidence_level: "standard"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", request.dashboard_id, compareResult.compare_id, "dashboard_compare"),
      capability: "dashboards",
      requested_mode: request.target_snapshot.mode,
      capability_submode: "dashboard_compare",
      source_refs: request.target_snapshot.source_dataset_refs,
      artifact_refs: [diffArtifact.artifact_id],
      progress: 100,
      stage: "dashboard_compare",
      state: "completed",
      warnings: [],
      failure_reason: null,
      retry_policy: { max_attempts: 1, strategy: "fixed", backoff_ms: 0 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: timestamp,
      finished_at: timestamp,
      resource_profile: { cpu_class: "standard", memory_class: "small", io_class: "balanced", expected_parallelism: 1 }
    });
    const auditEvents = [AuditEventSchema.parse({ contract: contractEnvelope("audit"), event_id: id("audit", request.dashboard_id, "dashboard.compare_versions.v1", timestamp), timestamp, actor_ref: request.actor_ref, actor_type: "service", action_ref: "dashboard.compare_versions.v1", job_ref: job.job_id, object_refs: [compareResult.compare_id, diffArtifact.artifact_id], workspace_id: request.workspace_id, tenant_ref: request.tenant_ref, metadata: { base_version: request.base_version.version_id, target_version: request.target_version.version_id } })];
    const lineageEdges: LineageEdge[] = [
      { edge_id: id("edge", request.base_version.version_id, compareResult.compare_id), from_ref: request.base_version.version_id, to_ref: diffArtifact.artifact_id, transform_ref: "dashboard.compare", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: request.target_snapshot.template_ref, dataset_binding_ref: "", version_diff_ref: compareResult.compare_id },
      { edge_id: id("edge", request.target_version.version_id, compareResult.compare_id), from_ref: request.target_version.version_id, to_ref: diffArtifact.artifact_id, transform_ref: "dashboard.compare", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: request.target_snapshot.template_ref, dataset_binding_ref: "", version_diff_ref: compareResult.compare_id }
    ];
    return this.store.persistCompare(
      { compareResult, diffArtifact, job, evidencePack, auditEvents, lineageEdges },
      {
        changed_widget_refs: changedWidgetRefs,
        changed_layout_item_refs: changedLayoutRefs,
        changed_filter_refs: changedFilterRefs,
        compare_result_contract: compareResult,
        base_snapshot: request.base_snapshot,
        target_snapshot: request.target_snapshot
      }
    );
  }
}

const dashboardToolToActionMap: Record<string, string> = {
  "registry.dashboard.create": "dashboard.create.v1",
  "registry.dashboard.mutate": "dashboard.mutate.v1",
  "registry.dashboard.refresh": "dashboard.refresh.v1",
  "registry.dashboard.publish": "dashboard.publish.v1",
  "registry.dashboard.compare_versions": "dashboard.compare_versions.v1",
  "registry.dashboard.interaction.filter": "dashboard.interaction.filter.v1",
  "registry.dashboard.interaction.selection": "dashboard.interaction.selection.v1",
  "registry.dashboard.interaction.drill": "dashboard.interaction.drill.v1",
  "registry.dashboard.interaction.refresh": "dashboard.interaction.refresh.v1",
  "registry.dashboard.interaction.compare": "dashboard.interaction.compare.v1"
};

export const dispatchDashboardAction = (input: DashboardDispatchRequest): unknown => {
  const request = DashboardDispatchRequestSchema.parse(input);
  const engine = new DashboardEngine({ storageDir: request.storage_dir });
  switch (request.action_id) {
    case "dashboard.create.v1":
      return engine.createDashboard(request.payload as CreateDashboardRequest);
    case "dashboard.mutate.v1":
      return engine.updateDashboard(request.payload as UpdateDashboardRequest);
    case "dashboard.refresh.v1":
      return engine.refreshDashboard(request.payload as RefreshDashboardRequest);
    case "dashboard.publish.v1":
      return engine.publishDashboard(request.payload as PublishDashboardRequest);
    case "dashboard.compare_versions.v1":
      return engine.compareDashboardVersions(request.payload as CompareDashboardVersionsRequest);
    case "dashboard.interaction.filter.v1":
    case "dashboard.interaction.selection.v1":
    case "dashboard.interaction.drill.v1":
    case "dashboard.interaction.refresh.v1":
    case "dashboard.interaction.compare.v1":
      return engine.executeInteraction(request.payload as ExecuteDashboardInteractionRequest);
    default:
      throw new Error(`Unsupported dashboard action: ${request.action_id}`);
  }
};

export const dispatchDashboardTool = (input: DashboardToolDispatchRequest): unknown => {
  const request = DashboardToolDispatchRequestSchema.parse(input);
  const actionId = dashboardToolToActionMap[request.tool_id];
  if (!actionId) {
    throw new Error(`Unsupported dashboard tool: ${request.tool_id}`);
  }
  return dispatchDashboardAction({
    action_id: actionId,
    payload: request.payload,
    storage_dir: request.storage_dir
  });
};

export const startDashboardPublicationService = (options?: DashboardEngineOptions): { host: string; port: number; base_url: string; storage_dir: string } => {
  const store = new DashboardEngineStore(options?.storageDir);
  ensureDashboardTransportServer(store, true);
  return {
    host: DASHBOARD_TRANSPORT_HOST,
    port: dashboardTransportPort,
    base_url: `http://${DASHBOARD_TRANSPORT_HOST}:${dashboardTransportPort}`,
    storage_dir: store.rootDir
  };
};

export const stopDashboardPublicationService = async (): Promise<void> => {
  if (!dashboardTransportServer) return;
  const current = dashboardTransportServer;
  dashboardTransportServer = null;
  dashboardTransportStore = null;
  servedPublicationRoutes.clear();
  await new Promise<void>((resolve) => {
    current.close(() => resolve());
  });
};

export const registerDashboardCapability = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === "dashboards");
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === "dashboards");
  runtime.registerCapability({ capability_id: "dashboards", display_name: "Dashboard Engine", package_name: "@rasid/dashboard-engine", contract_version: "1.0.0", supported_action_refs: actions.map((action) => action.action_id), supported_tool_refs: tools.map((tool) => tool.tool_id) });
  runtime.registerManifest(createActionManifest("dashboards", "1.0.0", actions, ["approval.dashboard"], ["evidence.dashboard"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.dashboard", async (action) => ({ approval_state: action.action_id === "dashboard.publish.v1" ? "pending" : "approved", reasons: action.action_id === "dashboard.publish.v1" ? ["publication_review_required"] : ["dashboard_default"] }));
  runtime.registerEvidenceHook("evidence.dashboard", async (pack) => EvidencePackSchema.parse(pack));
};
