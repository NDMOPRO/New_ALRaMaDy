# Rasid Data Platform — Shared Contracts Pack

Status: foundational and blocking  
Pack version: `1.0.0`  
Contract family namespace: `rasid.shared.*`  
Change policy: any breaking change requires a major version bump and an explicit migration plan

## 1. Shared architecture

### 1.1 Platform architecture map

```text
+--------------------+      +-------------------------+      +---------------------------+
| Sources/Connectors | ---> | Ingestion/Parse/Profile | ---> | Canonical Representation  |
+--------------------+      +-------------------------+      +---------------------------+
          |                              |                                 |
          v                              v                                 v
+--------------------+      +-------------------------+      +---------------------------+
| Source Registry    |      | Job Lifecycle Runtime   | <--> | Action Runtime            |
+--------------------+      +-------------------------+      +---------------------------+
                                              |                                 |
                                              v                                 v
                                    +-------------------+            +----------------------+
                                    | Tool Registry     |            | Evidence/Verification|
                                    +-------------------+            +----------------------+
                                              |                                 |
                                              v                                 v
                                    +-------------------+ <------> +----------------------+
                                    | Artifact Registry |          | Audit/Lineage Graph   |
                                    +-------------------+          +----------------------+
                                              |                                 |
                                              +---------------+-----------------+
                                                              |
                                                              v
                                         +-----------------------------------------------+
                                         | Unified Canvas / Workspace Runtime             |
                                         | Easy Mode | Advanced Mode | Drag/Drop | AI UX |
                                         +-----------------------------------------------+
                                                              |
                                                              v
                                    +-------------------+      +-------------------------+
                                    | Library/Assets    | <--> | Template/Brand          |
                                    +-------------------+      +-------------------------+
                                                              |
                                                              v
                                                   +----------------------+
                                                   | Publication/Export   |
                                                   +----------------------+
```

### 1.2 Non-negotiable architecture rules

1. Rasid is one web platform with one workspace/canvas shell.
2. All capabilities must use one canonical representation model.
3. All persisted outputs and intermediates must use one artifact model.
4. All async execution must use one shared job lifecycle.
5. All user-triggered and AI-assisted operations must use one action runtime contract.
6. All tools must register through one tool contract registry.
7. All outputs must populate one evidence and verification contract.
8. All activity must emit one audit and lineage contract.
9. All reusable assets must use one library contract.
10. All theming and branding must use one template/brand contract.
11. All connectors must use one source/connector contract.
12. All publishing must use one output publication contract.
13. All canvas interactions must use one canvas integration contract.
14. All execution outcomes must use one degrade/warning contract.
15. All tenancy and access control must use one tenant/permission contract.
16. Top-level platform mode is permanently `easy | advanced`; capability submodes may only layer beneath it.
17. Drag-and-drop is a first-class contract-driven interaction where relevant.
18. AI may propose, plan, and assist, but does not bypass approval, permissions, evidence, or audit.
19. Editable output is the default; non-editable output requires an explicitly labeled export path.
20. No contract may assume small files, small row counts, or bounded artifact counts.

## 2. Shared contracts

### 2.1 Contract envelope

Every shared contract is wrapped in a versioned envelope.

```yaml
ContractEnvelope:
  namespace: string            # e.g. rasid.shared.artifact
  contract_name: string
  contract_version: semver
  schema_version: semver
  status: enum[draft,active,deprecated,superseded]
  owner_ref: string
  compatibility:
    backward_compatible: boolean
    forward_compatible: boolean
  extension_policy:
    namespaced_extensions_only: boolean
    mandatory_field_override_forbidden: boolean
```

### 2.2 Canonical representation contract

Namespace: `rasid.shared.canonical`  
Version: `1.0.0`

Purpose: platform-wide typed representation for all parsed, generated, transformed, or intermediate content.

Rules:
1. No capability may invent a private incompatible representation.
2. Canonical nodes must be stable across source import, transformation, preview, editing, and export.
3. Canonical refs must remain addressable from artifacts, evidence, lineage, templates, and canvas state.

### 2.3 Artifact contract

Namespace: `rasid.shared.artifact`  
Version: `1.0.0`

Purpose: single persisted model for source, intermediate, generated, preview, export, and evidence artifacts.

### 2.4 Job / task lifecycle contract

Namespace: `rasid.shared.job`  
Version: `1.0.0`

Purpose: one async lifecycle for all background and long-running platform execution.

### 2.5 Action runtime contract

Namespace: `rasid.shared.action`  
Version: `1.0.0`

Purpose: one contract for user-triggered and AI-assisted operations with approval, replay, audit, and evidence hooks.

### 2.6 Tool registry contract

Namespace: `rasid.shared.tool_registry`  
Version: `1.0.0`

Purpose: one registry for capability actions and tool runtimes so teams can implement in parallel without inventing orchestration.

### 2.7 Evidence / verification contract

Namespace: `rasid.shared.evidence`  
Version: `1.0.0`

Purpose: one verification and evidence contract for meaningful outputs, previews, exports, and strict-labeled runs.

### 2.8 Audit / lineage contract

Namespace: `rasid.shared.audit`  
Version: `1.0.0`

Purpose: one queryable audit and lineage graph across artifacts, jobs, actions, templates, datasets, and AI decisions.

### 2.9 Library / asset contract

Namespace: `rasid.shared.library`  
Version: `1.0.0`

Purpose: one reusable asset library across templates, themes, datasets, logos, icons, workflow templates, and output starters.

### 2.10 Mode contract

Namespace: `rasid.shared.mode`  
Version: `1.0.0`

Purpose: freeze global mode semantics and make mode explicit in jobs, actions, canvas state, and artifacts.

### 2.11 Degradation / warning contract

Namespace: `rasid.shared.degrade`  
Version: `1.0.0`

Purpose: one platform-wide outcome policy distinguishing success, warnings, degraded, and failed states.

### 2.12 Template / brand contract

Namespace: `rasid.shared.template_brand`  
Version: `1.0.0`

Purpose: one reusable visual and layout contract across all output capabilities.

### 2.13 Permission / tenant contract

Namespace: `rasid.shared.permission`  
Version: `1.0.0`

Purpose: one multi-tenant isolation and authorization model for sources, assets, artifacts, publications, and audit visibility.

### 2.14 Source / connector contract

Namespace: `rasid.shared.source`  
Version: `1.0.0`

Purpose: one ingestion-facing source model spanning files, folders, URLs, APIs, databases, and future connectors.

### 2.15 Output publication contract

Namespace: `rasid.shared.publication`  
Version: `1.0.0`

Purpose: one publication/export model ensuring evidence, permissions, and editability rules remain consistent.

### 2.16 Canvas integration contract

Namespace: `rasid.shared.canvas`  
Version: `1.0.0`

Purpose: one UI/runtime contract for the unified canvas so no capability depends on a detached shell.

## 3. Shared schemas/models

### 3.1 Shared enums

```yaml
PlatformMode:
  type: enum[easy,advanced]

StrictnessMode:
  type: enum[strict,smart,flex]

EditableStatus:
  type: enum[editable,partially_editable,non_editable]

VerificationStatus:
  type: enum[unverified,verified,success_with_warnings,degraded,failed]

ExecutionOutcome:
  type: enum[success,success_with_warnings,degraded,failed]

JobState:
  type: enum[
    created,queued,parsing,profiling,planning,awaiting_approval,
    executing,verifying,completed,degraded,failed,cancelled,partially_completed
  ]

ApprovalPolicy:
  type: enum[never,conditional,always]

ApprovalState:
  type: enum[not_required,pending,approved,rejected]

Mutability:
  type: enum[read_only,mutating]

Idempotency:
  type: enum[idempotent,non_idempotent,conditionally_idempotent]
```

### 3.2 Common value objects

```yaml
Ref:
  id: string
  type: string

LocalizedText:
  value: string
  locale: string
  rtl: boolean

Warning:
  warning_code: string
  summary: string
  detail: string
  severity: enum[low,medium,high,critical]
  impacted_refs: string[]

FailureReason:
  reason_code: string
  summary: string
  detail: string
  impacted_refs: string[]
  retryable: boolean

Metric:
  metric_name: string
  metric_value: number
  metric_unit: string

VersionRef:
  version_id: string
  parent_version_id: string
  version_number: integer
  semantic_version: string

StorageRef:
  storage_id: string
  storage_class: string
  uri: string
  checksum: string
  region: string

PreviewRef:
  preview_id: string
  preview_type: enum[thumbnail,html_canvas,image_render,pdf_preview]
  storage_ref: string

ExportRef:
  export_id: string
  export_type: enum[pdf,pptx,xlsx,csv,png,json,zip,other]
  explicit_non_editable: boolean
  storage_ref: string

PermissionScope:
  visibility: enum[private,workspace,tenant,shared_link]
  allow_read: boolean
  allow_write: boolean
  allow_share: boolean
  allow_publish: boolean
  allow_audit_view: boolean

RetryPolicy:
  max_attempts: integer
  strategy: enum[fixed,exponential]
  backoff_ms: integer

ResourceProfile:
  cpu_class: string
  memory_class: string
  io_class: string
  expected_parallelism: integer

JsonSchemaRef:
  schema_id: string
  schema_version: semver
  uri: string
```

### 3.3 Canonical representation model

```yaml
CanonicalRepresentation:
  contract:
    namespace: rasid.shared.canonical
    version: 1.0.0
  canonical_id: string
  tenant_ref: string
  workspace_id: string
  project_id: string
  source_descriptors: SourceDescriptor[]
  representation_kind: enum[
    document,spreadsheet,presentation,dashboard,report,intermediate_converted_artifact
  ]
  strictness_mode: StrictnessMode
  localization:
    locale: string
    rtl: boolean
    numeral_system: string
    fallback_locales: string[]
  root_node_refs: string[]
  nodes:
    documents: DocumentNode[]
    pages: PageNode[]
    sheets: SheetNode[]
    slides: SlideNode[]
    tables: TableNode[]
    charts: ChartNode[]
    shapes: ShapeNode[]
    text: TextNode[]
    images: ImageNode[]
  layout_metadata: LayoutMetadata
  data_binding_refs: DataBindingRef[]
  formula_refs: FormulaRef[]
  semantic_labels: SemanticLabel[]
  lineage_refs: string[]
  template_refs: string[]
  editability_flags:
    default_editable: boolean
    locked_region_refs: string[]
    lock_reason_codes: string[]
  evidence_refs: string[]
  created_at: datetime
  updated_at: datetime

SourceDescriptor:
  source_ref: string
  source_type: string
  source_revision_ref: string
  parser_profile: string
  connector_ref: string

BaseNode:
  node_id: string
  node_type: string
  parent_node_ref: string
  child_node_refs: string[]
  name: string
  semantic_labels: string[]
  layout_ref: string
  data_binding_refs: string[]
  formula_refs: string[]
  lineage_refs: string[]
  template_refs: string[]
  evidence_refs: string[]
  editable: boolean

DocumentNode:
  extends: BaseNode
  node_type: document
  page_refs: string[]
  section_refs: string[]

PageNode:
  extends: BaseNode
  node_type: page
  width: number
  height: number
  unit: string
  layer_refs: string[]

SheetNode:
  extends: BaseNode
  node_type: sheet
  table_refs: string[]
  chart_refs: string[]
  grid_bounds:
    row_count: integer
    column_count: integer

SlideNode:
  extends: BaseNode
  node_type: slide
  slide_index: integer
  master_ref: string
  element_refs: string[]

TableNode:
  extends: BaseNode
  node_type: table
  row_count: integer
  column_count: integer
  schema_ref: string

ChartNode:
  extends: BaseNode
  node_type: chart
  chart_type: string
  series_refs: string[]
  axis_refs: string[]

ShapeNode:
  extends: BaseNode
  node_type: shape
  shape_type: string
  style_ref: string

TextNode:
  extends: BaseNode
  node_type: text
  content: LocalizedText[]
  typography_ref: string

ImageNode:
  extends: BaseNode
  node_type: image
  image_asset_ref: string
  crop_metadata: object

LayoutMetadata:
  coordinate_space: enum[page,sheet,slide,canvas]
  bounding_boxes: object[]
  z_order: object[]
  grid_rules: object[]
  alignment_rules: object[]

DataBindingRef:
  binding_id: string
  dataset_ref: string
  query_ref: string
  target_node_ref: string
  field_mappings: object[]

FormulaRef:
  formula_id: string
  expression: string
  dialect: string
  target_ref: string
  dependency_refs: string[]

SemanticLabel:
  label_id: string
  label_type: string
  label_value: string
  target_ref: string
```

### 3.4 Artifact model

```yaml
Artifact:
  contract:
    namespace: rasid.shared.artifact
    version: 1.0.0
  artifact_id: string
  artifact_type: enum[
    source_file,normalized_dataset,workflow_output,report,dashboard,presentation,
    spreadsheet,strict_output,preview_render,export_bundle,evidence_pack
  ]
  artifact_subtype: string
  project_id: string
  workspace_id: string
  source_refs: string[]
  parent_artifact_refs: string[]
  canonical_ref: string
  created_by: string
  created_at: datetime
  mode: PlatformMode
  editable_status: EditableStatus
  template_status: enum[none,applied,soft_locked,strict_locked]
  lineage_ref: string
  evidence_ref: string
  verification_status: VerificationStatus
  storage_ref: StorageRef
  preview_ref: PreviewRef
  export_refs: ExportRef[]
  version_ref: VersionRef
  tenant_ref: string
  permission_scope: PermissionScope
```

### 3.5 Job lifecycle model

```yaml
Job:
  contract:
    namespace: rasid.shared.job
    version: 1.0.0
  job_id: string
  capability: enum[
    strict_replication,presentations,excel_data,dashboards,reports,lct,
    rasid_intelligent_operator,unified_canvas
  ]
  requested_mode: PlatformMode
  capability_submode: string
  source_refs: string[]
  artifact_refs: string[]
  progress: number
  stage: string
  state: JobState
  warnings: Warning[]
  failure_reason: FailureReason
  retry_policy: RetryPolicy
  evidence_ref: string
  started_at: datetime
  finished_at: datetime
  resource_profile: ResourceProfile
```

State transition rules:
1. `created -> queued`
2. `queued -> parsing | planning | cancelled`
3. `parsing -> profiling | failed | cancelled`
4. `profiling -> planning | degraded | failed`
5. `planning -> awaiting_approval | executing | failed`
6. `awaiting_approval -> executing | cancelled`
7. `executing -> verifying | degraded | failed | partially_completed | cancelled`
8. `verifying -> completed | degraded | failed | partially_completed`
9. `degraded`, `failed`, `cancelled`, `completed`, `partially_completed` are terminal

### 3.6 Action runtime contract

```yaml
ActionDefinition:
  contract:
    namespace: rasid.shared.action
    version: 1.0.0
  action_id: string
  action_name: string
  capability: string
  input_schema: JsonSchemaRef
  output_schema: JsonSchemaRef
  required_permissions: string[]
  mode_support:
    easy: boolean
    advanced: boolean
  approval_policy: ApprovalPolicy
  preview_support: boolean
  mutability: Mutability
  idempotency: Idempotency
  side_effects: string[]
  evidence_requirements: string[]
  degrade_policy_ref: string

ActionExecution:
  execution_id: string
  action_id: string
  execution_source: enum[manual_invocation,ai_proposal,approved_ai_apply,system_replay]
  approval_state: ApprovalState
  actor_ref: string
  input_payload_hash: string
  output_refs: string[]
  job_ref: string
  deterministic_log_ref: string
  replay_token: string
  started_at: datetime
  finished_at: datetime
```

Mandatory behavior:
1. Manual invocation must be supported.
2. AI proposal must be supported.
3. Approval before apply must be supported when policy requires it.
4. Deterministic logging must be emitted for every execution.
5. Replay and re-run must be addressable using `replay_token`.
6. Every execution must be auditable.

### 3.7 Tool registry contract

```yaml
ToolRegistration:
  contract:
    namespace: rasid.shared.tool_registry
    version: 1.0.0
  tool_id: string
  owner_capability: string
  version: semver
  input_contract: JsonSchemaRef
  output_contract: JsonSchemaRef
  runtime_dependencies: string[]
  performance_profile:
    expected_latency_ms_p50: number
    expected_latency_ms_p95: number
    peak_memory_mb: number
    scale_profile: string
  verification_hooks: string[]
  safe_failure_behavior:
    retryable: boolean
    fallback_action_ref: string
    degrade_reason_codes: string[]
  registration_status: enum[active,blocked,deprecated]
```

### 3.8 Mode contract

```yaml
ModeContext:
  contract:
    namespace: rasid.shared.mode
    version: 1.0.0
  top_level_mode: PlatformMode
  capability_submode: string
  guidance_level: enum[guided,balanced,fully_explicit]
  automation_level: enum[safe_defaults,operator_assisted,manual_control]
```

Platform semantics:
1. `easy` means minimal configuration, safe defaults, guided automation, and reduced exposed complexity.
2. `advanced` means full control, explicit mappings, explicit settings, and direct operator adjustment.
3. Capability-specific submodes are additive metadata only and cannot replace `easy | advanced`.

### 3.9 Evidence / verification contract

```yaml
ValidationCheckResult:
  check_id: string
  check_name: string
  check_type: string
  passed: boolean
  severity: enum[low,medium,high,critical]
  details: string
  impacted_refs: string[]

EvidencePack:
  contract:
    namespace: rasid.shared.evidence
    version: 1.0.0
  evidence_pack_id: string
  verification_status: VerificationStatus
  source_refs: string[]
  generated_artifact_refs: string[]
  checks_executed: ValidationCheckResult[]
  before_refs: string[]
  after_refs: string[]
  metrics: Metric[]
  warnings: Warning[]
  failure_reasons: FailureReason[]
  degraded_reasons: FailureReason[]
  replay_context: object
  reproducibility_metadata:
    replay_token: string
    execution_seed: string
    environment_stamp: string
    tool_versions: object[]
  strict_evidence_level: enum[standard,strong]
```

Evidence rules:
1. Every meaningful output must populate `verification_status` and `evidence_pack_id`.
2. `strict_output` artifacts require `strict_evidence_level=strong`.
3. No service may claim success while evidence is absent.

### 3.10 Audit / lineage contract

```yaml
AuditEvent:
  contract:
    namespace: rasid.shared.audit
    version: 1.0.0
  event_id: string
  timestamp: datetime
  actor_ref: string
  actor_type: enum[user,service,ai]
  action_ref: string
  job_ref: string
  object_refs: string[]
  workspace_id: string
  tenant_ref: string
  metadata: object

LineageEdge:
  edge_id: string
  from_ref: string
  to_ref: string
  transform_ref: string
  ai_suggestion_ref: string
  ai_decision: enum[accepted,rejected,not_applicable]
  template_ref: string
  dataset_binding_ref: string
  version_diff_ref: string

LineageQueryKeys:
  artifact_id: string
  dataset_id: string
  report_id: string
  dashboard_id: string
  presentation_id: string
  workflow_run_id: string
```

Mandatory capture:
1. who triggered what
2. which sources were used
3. which transformations ran
4. which AI suggestions were accepted or rejected
5. which outputs were created
6. which templates or brands were applied
7. which datasets were bound
8. what changed between versions

### 3.11 Library / asset contract

```yaml
LibraryAsset:
  contract:
    namespace: rasid.shared.library
    version: 1.0.0
  asset_id: string
  asset_type: enum[
    file,template,theme,logo,icon,presentation,report,dashboard,dataset,
    workflow_template,brand_pack
  ]
  source: string
  tags: string[]
  version: semver
  tenant_scope: enum[tenant,workspace,user]
  permission_scope: PermissionScope
  reuse_policy: enum[free,restricted,approval_required]
  dependency_refs: string[]
  created_at: datetime
  updated_at: datetime
```

### 3.12 Template / brand contract

```yaml
TemplateBrandPreset:
  contract:
    namespace: rasid.shared.template_brand
    version: 1.0.0
  preset_id: string
  preset_scope: enum[org_preset,workspace_preset,user_preset,uploaded_custom_preset]
  colors: object[]
  fonts: object[]
  logos: string[]
  layout_rules: object[]
  spacing_grid_rules: object[]
  chart_palette: object[]
  icon_style: string
  rtl_support: boolean
  lock_behavior:
    strict_lock: boolean
    soft_lock: boolean
```

### 3.13 Permission / tenant contract

```yaml
Tenant:
  contract:
    namespace: rasid.shared.permission
    version: 1.0.0
  tenant_ref: string
  isolation_boundary: string

Workspace:
  workspace_id: string
  tenant_ref: string
  project_refs: string[]

RoleBinding:
  principal_ref: string
  role: enum[owner,admin,editor,analyst,viewer,auditor,service]
  scope: enum[tenant,workspace,asset,source,artifact,audit]
  scope_ref: string
```

Permission rules:
1. Multi-tenant isolation is mandatory.
2. Workspace-level scope is mandatory.
3. Role-based access is mandatory.
4. Asset-level, source-level, artifact-level, and audit visibility controls are mandatory.
5. No capability may define private permission semantics outside this contract.

### 3.14 Source / connector contract

```yaml
Source:
  contract:
    namespace: rasid.shared.source
    version: 1.0.0
  source_id: string
  source_type: enum[
    uploaded_file,folder_batch,url,api,database,document_file,spreadsheet_file,
    image,presentation_file,future_connector
  ]
  ingestion_batch_id: string
  tenant_ref: string
  original_name: string
  media_type: string
  size: number
  parser_status: enum[pending,parsed,failed]
  profiling_status: enum[pending,profiled,failed]
  schema_summary: object
  sensitivity_hint: enum[public,internal,confidential,restricted]
  connector_ref: string
```

### 3.15 Output publication contract

```yaml
Publication:
  contract:
    namespace: rasid.shared.publication
    version: 1.0.0
  publication_id: string
  artifact_ref: string
  publication_type: enum[preview,internal_publish,external_export,bundle]
  editable_default: boolean
  explicit_non_editable_export: boolean
  target_ref: string
  published_by: string
  published_at: datetime
  permission_scope: PermissionScope
  evidence_ref: string
```

### 3.16 Canvas integration contract

```yaml
CanvasSessionState:
  contract:
    namespace: rasid.shared.canvas
    version: 1.0.0
  session_id: string
  tenant_ref: string
  workspace_id: string
  project_id: string
  mode_state: ModeContext
  selected_sources: string[]
  selected_artifacts: string[]
  action_suggestions: ActionSuggestion[]
  action_execution_state: ActionExecutionState[]
  inspector_state: object
  evidence_drawer_state: object
  compare_state: object
  library_state: object
  drag_drop_payloads: DragDropPayload[]

ActionSuggestion:
  suggestion_id: string
  action_ref: string
  origin: enum[user_context,rule_engine,ai]
  requires_approval: boolean

ActionExecutionState:
  execution_ref: string
  state: enum[idle,pending,running,verifying,completed,degraded,failed]
  warning_refs: string[]

DragDropPayload:
  payload_id: string
  payload_type: enum[source_ref,artifact_ref,asset_ref,template_ref,data_binding]
  refs: string[]
  origin_surface: string
  target_surface: string
  timestamp: datetime
```

### 3.17 Degradation / warning contract

```yaml
DegradeReport:
  contract:
    namespace: rasid.shared.degrade
    version: 1.0.0
  outcome: ExecutionOutcome
  warnings: Warning[]
  degraded_reasons: FailureReason[]
  what_degraded: string[]
  remaining_editable_refs: string[]
  non_editable_refs: string[]
  rerun_possible: boolean
  repair_possible: boolean
  suggested_repair_actions: string[]
```

Required semantics:
1. `success` means requested behavior completed with no material warnings.
2. `success_with_warnings` means output is usable and contract-complete, but warnings require visibility.
3. `degraded` means output exists but some requested fidelity, completeness, binding, or editability is reduced.
4. `failed` means no contract-valid result for the requested action.
5. Silent degradation is forbidden.

### 3.18 Versioning and extension rules

1. Every contract and schema is semver versioned.
2. Breaking changes require a major version bump, migration definition, and compatibility review.
3. Additive backward-compatible fields require a minor version bump.
4. Patch versions are limited to non-structural corrections.
5. Extensions must be namespaced as `x_<team>_<field>`.
6. Extensions may add optional metadata only.
7. Extensions may not redefine mandatory fields, shared enums, lifecycle states, or outcome semantics.

## 4. Integration rules

1. All capabilities must read and write the shared contracts as the system of record.
2. No capability may persist a private artifact model, private job state model, or private evidence status as a substitute for these contracts.
3. Source ingestion must emit `Source` records before parsing or profiling begins.
4. Parsing and profiling must materialize `CanonicalRepresentation` or a typed failure state; no opaque black-box intermediate is allowed.
5. Every generated or intermediate output must materialize as an `Artifact`.
6. Every async run must materialize as a `Job`.
7. Every executable user or AI operation must materialize as `ActionDefinition` and `ActionExecution`.
8. Every tool implementation must be registered in `ToolRegistration`.
9. Every meaningful artifact must carry `lineage_ref`, `evidence_ref`, `verification_status`, `tenant_ref`, `permission_scope`, and `mode`.
10. Every strict-labeled artifact must use `strict_output` type and strong evidence.
11. Every publication or export must reference `Publication` and preserve editability semantics.
12. Easy/Advanced mode must be explicit in canvas state, job metadata, action runtime context, and artifact metadata.
13. Capability-specific submodes must never replace top-level mode.
14. Unified canvas is the only supported runtime shell; no detached app dependency may be required.
15. Drag-and-drop must use typed `DragDropPayload` only.
16. AI-suggested actions must log accepted and rejected decisions in audit and lineage.
17. Degraded, warning, and failed outcomes must populate `DegradeReport` and evidence state consistently.
18. Permission checks must apply before action execution, artifact mutation, publication, and audit reads.

## 5. Risks

1. Contract drift across teams if the schema registry is not governed centrally.
2. Enum fragmentation if teams try to encode capability-specific semantics into shared enum fields.
3. Canonical model overloading if unsupported private node types are introduced without review.
4. Evidence under-population leading to false completion claims.
5. Audit volume and lineage graph scale may become a bottleneck without query partitioning and indexing.
6. Permission leakage is possible if publication and preview pathways bypass shared scope evaluation.
7. Mode inconsistency can emerge if frontend state and backend persisted metadata diverge.
8. Degradation semantics can become ambiguous without a centrally maintained reason-code taxonomy.
9. Template lock semantics can become inconsistent if strict lock and soft lock are not enforced uniformly.

## 6. Deferrals

1. Capability-specific algorithms for strict replication, dashboards, reports, presentations, Excel/data, LCT, or operator planning.
2. UI component implementation details beyond the canvas contract and runtime state shape.
3. Storage vendor selection, physical persistence topology, and queue implementation specifics.
4. Connector-specific authentication and transport details behind `connector_ref`.
5. Rendering engine internals, charting engine internals, and formula evaluation engine internals.
6. Scheduling, autoscaling, and infrastructure operations internals.

## 7. Acceptance gates

The shared pack is accepted only if all items below remain true:

1. All listed shared contracts are explicitly defined and versioned.
2. Canonical, artifact, job, action, tool, evidence, audit, library, template, source, publication, canvas, degrade, mode, and permission contracts are platform-wide rather than capability-private.
3. Every required field listed in the task is present and typed.
4. No detached mini-product assumption exists in execution or UI integration.
5. No capability needs a private incompatible artifact, job, or state model to ship.
6. Degrade policy is explicit and silent degradation is impossible by contract.
7. Evidence policy is explicit and verification metadata is mandatory for meaningful outputs.
8. Multi-tenant isolation and permission scope are explicit.
9. Canvas integration path is explicit, including drag/drop payloads, inspector, compare, evidence, library, and mode state.
10. All capabilities named in the task can implement later against these contracts without redefining core models.

## 8. First implementation milestone for the shared pack

Milestone name: `M1 - Contract Freeze and Registry Bootstrap`

Scope:
1. Publish machine-readable schemas for every shared contract under one registry namespace.
2. Add schema validation to source ingest, action submission, job updates, artifact persistence, publication writes, and evidence writes.
3. Add conformance tests for required fields, enum values, lifecycle transitions, and backward-compatibility checks.
4. Add audit hooks for action execution, AI proposals, AI approvals/rejections, artifact creation, and publication events.
5. Block writes that do not conform to the shared contracts.

Exit criteria:
1. A sample flow `source -> canonical -> job -> action -> artifact -> evidence -> publication -> canvas state` validates end-to-end.
2. No service endpoint can persist a non-conformant artifact, job, evidence pack, or publication record.
3. A degraded run is visible simultaneously in job state, artifact verification status, evidence pack, and canvas execution state.
4. Top-level `easy | advanced` mode is present in job, artifact, action context, and canvas state.
