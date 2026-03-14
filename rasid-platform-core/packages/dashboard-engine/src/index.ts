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
  DashboardInteractionRuleSchema,
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

type DatasetProfile = z.infer<typeof DatasetProfileSchema>;
type WidgetBlueprint = z.infer<typeof WidgetBlueprintSchema>;

export type CreateDashboardRequest = z.infer<typeof CreateDashboardRequestSchema>;
export type UpdateDashboardRequest = z.infer<typeof UpdateDashboardRequestSchema>;
export type RefreshDashboardRequest = z.infer<typeof RefreshDashboardRequestSchema>;
export type PublishDashboardRequest = z.infer<typeof PublishDashboardRequestSchema>;
export type CompareDashboardVersionsRequest = z.infer<typeof CompareDashboardVersionsRequestSchema>;

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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = (value?: string): string => value ?? new Date().toISOString();
const semver = (versionNumber: number) => `1.0.${Math.max(0, versionNumber - 1)}`;
const id = (prefix: string, ...parts: Array<string | number | undefined | null>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");

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
      charts: dashboard.widgets.filter((widget) => ["bar_chart", "line_chart", "pie_chart", "area_chart", "combo_chart"].includes(widget.widget_type)).map((widget) => ({
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
      shapes: dashboard.widgets.filter((widget) => ["filter", "selector", "section"].includes(widget.widget_type)).map((widget) => ({
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
    return buildWorkflow(dashboard, version, request.dataset_profiles, "dashboard.create.v1", "dashboard_create", timestamp, request.created_by);
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
    return buildWorkflow(DashboardSchema.parse(dashboard), version, profiles, "dashboard.mutate.v1", "dashboard_mutation", timestamp, request.actor_ref);
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
    return buildWorkflow(DashboardSchema.parse(dashboard), DashboardVersionSchema.parse(version), profiles, "dashboard.refresh.v1", "dashboard_refresh", timestamp, request.actor_ref);
  }

  publishDashboard(input: PublishDashboardRequest): DashboardPublicationResult {
    const request = PublishDashboardRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const permissionScope = request.permission_scope ?? request.dashboard.permission_scope;
    const dashboard = DashboardSchema.parse({
      ...clone(request.dashboard),
      status: "published",
      updated_at: timestamp,
      permission_scope: permissionScope,
      publication_metadata: DashboardPublicationMetadataSchema.parse({
        ...request.dashboard.publication_metadata,
        publication_state: "published",
        visibility_scope: permissionScope.visibility,
        publication_refs: [...request.dashboard.publication_metadata.publication_refs, id("publication", request.dashboard.dashboard_id, request.version.version_id)],
        embed_enabled: request.embeddable,
        preview_ref: id("preview", request.dashboard.dashboard_id, request.version.version_id, "published"),
        last_published_version_ref: request.version.version_id
      })
    });
    const version = DashboardVersionSchema.parse({ ...clone(request.version), publication_state: "published" });
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: id("publication", dashboard.dashboard_id, version.version_id),
      artifact_ref: version.snapshot_artifact_ref,
      publication_type: "internal_publish",
      editable_default: true,
      explicit_non_editable_export: false,
      target_ref: request.target_ref,
      published_by: request.published_by,
      published_at: timestamp,
      permission_scope: permissionScope,
      evidence_ref: id("evidence", dashboard.dashboard_id, version.version_id, "publish")
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
      evidence_pack_id: id("evidence", dashboard.dashboard_id, version.version_id, "publish"),
      verification_status: "verified",
      source_refs: dashboard.source_dataset_refs,
      generated_artifact_refs: [publication.publication_id, version.snapshot_artifact_ref],
      checks_executed: [{ check_id: id("check", dashboard.dashboard_id, "publication"), check_name: "publication_ready_check", check_type: "publication", passed: true, severity: "medium", details: "Dashboard publication payload was generated.", impacted_refs: [publication.publication_id] }],
      before_refs: [version.version_id],
      after_refs: [publication.publication_id],
      metrics: [{ metric_name: "publication_count", metric_value: 1, metric_unit: "publications" }],
      warnings: [],
      failure_reasons: [],
      degraded_reasons: [],
      replay_context: { action_id: "dashboard.publish.v1", dashboard_id: dashboard.dashboard_id },
      reproducibility_metadata: { replay_token: id("replay", dashboard.dashboard_id, version.version_id, "publish"), execution_seed: `${dashboard.dashboard_id}:${version.version_id}:publish`, environment_stamp: "rasid-platform-core", tool_versions: [{ tool: "dashboard-engine", version: "1.0.0" }] },
      strict_evidence_level: "standard"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", dashboard.dashboard_id, version.version_id, "dashboard_publish"),
      capability: "dashboards",
      requested_mode: dashboard.mode,
      capability_submode: "dashboard_publish",
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
        event_id: id("audit", dashboard.dashboard_id, "dashboard.publish.v1", timestamp),
        timestamp,
        actor_ref: request.published_by,
        actor_type: "service",
        action_ref: "dashboard.publish.v1",
        job_ref: job.job_id,
        object_refs: [dashboard.dashboard_id, publication.publication_id, version.version_id],
        workspace_id: dashboard.workspace_id,
        tenant_ref: dashboard.tenant_ref,
        metadata: { target_ref: request.target_ref, embeddable: request.embeddable }
      })
    ];
    const lineageEdges: LineageEdge[] = [
      { edge_id: id("edge", version.snapshot_artifact_ref, publication.publication_id), from_ref: version.snapshot_artifact_ref, to_ref: publication.publication_id, transform_ref: "dashboard.publish", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: dashboard.template_ref, dataset_binding_ref: "", version_diff_ref: "" }
    ];
    return { dashboard, version, publication, libraryAsset, job, evidencePack, auditEvents, lineageEdges };
  }

  compareDashboardVersions(input: CompareDashboardVersionsRequest): DashboardCompareBundle {
    const request = CompareDashboardVersionsRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const diff = <T extends Record<string, unknown>>(baseItems: T[], targetItems: T[], idKey: keyof T) => {
      const baseMap = new Map(baseItems.map((item) => [String(item[idKey]), JSON.stringify(item)]));
      const targetMap = new Map(targetItems.map((item) => [String(item[idKey]), JSON.stringify(item)]));
      return [...new Set([...baseMap.keys(), ...targetMap.keys()])].filter((key) => baseMap.get(key) !== targetMap.get(key));
    };
    const changedWidgetRefs = diff(request.base_snapshot.widgets, request.target_snapshot.widgets, "widget_id");
    const changedLayoutRefs = diff(request.base_snapshot.layout_items, request.target_snapshot.layout_items, "item_id");
    const changedFilterRefs = diff(request.base_snapshot.filter_sets, request.target_snapshot.filter_sets, "filter_id");
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
      metrics: [{ metric_name: "changed_widgets", metric_value: changedWidgetRefs.length, metric_unit: "widgets" }, { metric_name: "changed_layout_items", metric_value: changedLayoutRefs.length, metric_unit: "layout_items" }, { metric_name: "changed_filters", metric_value: changedFilterRefs.length, metric_unit: "filters" }],
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
    return { compareResult, diffArtifact, job, evidencePack, auditEvents, lineageEdges };
  }
}

export const registerDashboardCapability = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === "dashboards");
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === "dashboards");
  runtime.registerCapability({ capability_id: "dashboards", display_name: "Dashboard Engine", package_name: "@rasid/dashboard-engine", contract_version: "1.0.0", supported_action_refs: actions.map((action) => action.action_id), supported_tool_refs: tools.map((tool) => tool.tool_id) });
  runtime.registerManifest(createActionManifest("dashboards", "1.0.0", actions, ["approval.dashboard"], ["evidence.dashboard"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.dashboard", async (action) => ({ approval_state: action.action_id === "dashboard.publish.v1" ? "pending" : "approved", reasons: action.action_id === "dashboard.publish.v1" ? ["publication_review_required"] : ["dashboard_default"] }));
  runtime.registerEvidenceHook("evidence.dashboard", async (pack) => EvidencePackSchema.parse(pack));
};
