# Rasid Data Platform — Shared Contracts Pack (v1.0.0)

Status: **Foundational / Blocking**  
Scope: platform-wide, capability-agnostic shared contracts.  
Constraint: no capability-specific service may bypass or redefine these contracts.

## 1) Shared architecture

### 1.1 Platform architecture map

```text
[Sources/Connectors] -> [Ingestion + Profiling] -> [Canonical Representation Store]
                                         |                       |
                                         v                       v
                                   [Job Orchestrator] <-> [Action Runtime]
                                         |                       |
                                         v                       v
                                 [Tool Registry]         [Evidence Engine]
                                         |                       |
                                         v                       v
                                   [Artifact Store] <-> [Audit/Lineage]
                                         |                       |
                                         v                       v
                                   [Library/Assets] <-> [Template/Brand]
                                         |                       |
                                         +--------- [Unified Canvas] --------+
                                                       |   |   |   |         |
                                                   Easy/Advanced mode, DnD, inspector,
                                                   evidence drawer, compare, publish
```

### 1.2 Architectural invariants (non-negotiable)

1. One platform runtime and one unified canvas shell.
2. One canonical representation model for all capabilities.
3. One artifact model for source/intermediate/final outputs.
4. One async job lifecycle and status semantics.
5. One evidence + verification model for all outputs.
6. One audit + lineage graph model.
7. One permission + tenant model.
8. One library + integration + template/brand model.
9. Global dual mode only at top level: `easy | advanced`.
10. Drag/drop payload contracts are shared and stable.

---

## 2) Shared contracts

All contracts are typed, versioned, and capability-agnostic.

### 2.1 Contract envelope (applies to every contract)

```yaml
ContractEnvelope:
  contract_name: string
  contract_version: semver
  schema_version: semver
  status: enum[draft,active,deprecated]
  owner: string
  compatibility:
    backward: boolean
    forward: boolean
  extensions_allowed: boolean
```

### 2.2 Canonical representation contract (`CanonicalRepresentation@1.0.0`)

```yaml
CanonicalRepresentation:
  canonical_id: string
  tenant_ref: string
  workspace_id: string
  strictness_mode: enum[strict,smart,flex]
  source_descriptors: SourceDescriptor[]
  entities:
    documents: DocumentNode[]
    pages: PageNode[]
    sheets: SheetNode[]
    slides: SlideNode[]
    tables: TableNode[]
    charts: ChartNode[]
    shapes: ShapeNode[]
    text_blocks: TextNode[]
    images: ImageNode[]
  layout_metadata: LayoutMetadata
  data_binding_refs: DataBindingRef[]
  formula_refs: FormulaRef[]
  semantic_labels: SemanticLabel[]
  lineage_refs: string[]
  template_refs: string[]
  localization:
    locale: string
    rtl: boolean
    numeral_system: string
  editability_flags:
    editable: boolean
    locked_regions: string[]
    lock_reason: string[]
  evidence_refs: string[]
  created_at: datetime
  updated_at: datetime
```

### 2.3 Artifact contract (`Artifact@1.0.0`)

```yaml
Artifact:
  artifact_id: string
  artifact_type: enum[
    source_file, normalized_dataset, workflow_output, report, dashboard,
    presentation, spreadsheet, strict_output, preview_render,
    export_bundle, evidence_pack
  ]
  artifact_subtype: string
  project_id: string
  workspace_id: string
  source_refs: string[]
  parent_artifact_refs: string[]
  created_by: string
  created_at: datetime
  mode: enum[easy,advanced]
  editable_status: enum[editable,partially_editable,non_editable]
  template_status: enum[none,applied,locked,soft_locked]
  lineage_ref: string
  evidence_ref: string
  verification_status: enum[unverified,verified,warning,degraded,failed]
  storage_ref: string
  preview_ref: string
  export_refs: string[]
  version_ref: string
  tenant_ref: string
  permission_scope: PermissionScope
```

### 2.4 Job/task lifecycle contract (`JobLifecycle@1.0.0`)

```yaml
Job:
  job_id: string
  capability: enum[
    strict_replication,presentations,excel_data,dashboards,reports,lct,
    rasid_operator,unified_canvas
  ]
  requested_mode: enum[easy,advanced]
  source_refs: string[]
  artifact_refs: string[]
  state: enum[
    created,queued,parsing,profiling,planning,awaiting_approval,
    executing,verifying,completed,degraded,failed,cancelled,partially_completed
  ]
  progress: number # 0..100
  stage: string
  warnings: Warning[]
  failure_reason: string
  retry_policy: RetryPolicy
  evidence_ref: string
  started_at: datetime
  finished_at: datetime
  resource_profile:
    cpu_class: string
    memory_class: string
    io_class: string
```

### 2.5 Action runtime contract (`ActionRuntime@1.0.0`)

```yaml
ActionDefinition:
  action_id: string
  action_name: string
  capability: string
  input_schema: JsonSchemaRef
  output_schema: JsonSchemaRef
  required_permissions: string[]
  mode_support:
    easy: boolean
    advanced: boolean
  approval_policy: enum[never,conditional,always]
  preview_support: boolean
  mutability: enum[read_only,mutating]
  idempotency: enum[idempotent,non_idempotent]
  side_effects: string[]
  evidence_requirements: string[]
  degrade_policy: DegradePolicyRef

ActionExecution:
  execution_id: string
  action_id: string
  invoke_type: enum[manual,ai_proposal,system]
  approval_state: enum[not_required,pending,approved,rejected]
  actor_ref: string
  inputs_hash: string
  output_ref: string
  deterministic_log_ref: string
  replay_token: string
  started_at: datetime
  finished_at: datetime
```

### 2.6 Tool registry contract (`ToolRegistry@1.0.0`)

```yaml
ToolRegistration:
  tool_id: string
  owner_capability: string
  version: semver
  input_contract: JsonSchemaRef
  output_contract: JsonSchemaRef
  runtime_dependencies: string[]
  performance_profile:
    expected_latency_ms_p50: number
    expected_latency_ms_p95: number
    memory_mb: number
  verification_hooks: string[]
  safe_failure_behavior:
    retryable: boolean
    fallback_action: string
    degrade_reason_code: string
  status: enum[active,deprecated,blocked]
```

### 2.7 Evidence/verification contract (`Evidence@1.0.0`)

```yaml
EvidenceStatus:
  verification_status: enum[unverified,verified,success_with_warnings,degraded,failed]
  evidence_pack_ref: string
  warnings: Warning[]
  validation_checks_executed: ValidationCheckResult[]
  failure_reasons: string[]
  degraded_reasons: string[]
  reproducibility_metadata:
    replay_token: string
    seed: string
    environment_stamp: string

EvidencePack:
  evidence_pack_id: string
  source_refs: string[]
  generated_artifact_refs: string[]
  checks_executed: ValidationCheckResult[]
  before_refs: string[]
  after_refs: string[]
  metrics: Metric[]
  warnings_errors: WarningOrError[]
  replay_context: object
  environment_stamp: string
  strict_evidence_level: enum[standard,strong]
```

### 2.8 Audit/lineage contract (`AuditLineage@1.0.0`)

```yaml
AuditEvent:
  event_id: string
  timestamp: datetime
  actor_ref: string
  actor_type: enum[user,service,ai]
  action_ref: string
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
```

Queryable keys mandatory: `artifact_id`, `dataset_id`, `report_id`, `dashboard_id`, `presentation_id`, `workflow_run_id`.

### 2.9 Library/asset contract (`LibraryAsset@1.0.0`)

```yaml
LibraryAsset:
  asset_id: string
  asset_type: enum[
    file,template,theme,logo,icon,presentation,report,dashboard,
    dataset,workflow_template,brand_pack
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

### 2.10 Template/brand contract (`TemplateBrand@1.0.0`)

```yaml
TemplateBrandPreset:
  preset_id: string
  scope: enum[org,workspace,user,uploaded_custom]
  colors: ColorToken[]
  fonts: FontToken[]
  logos: AssetRef[]
  layout_rules: LayoutRule[]
  spacing_grid_rules: GridRule[]
  chart_palette: ColorToken[]
  icon_style: string
  rtl_support: boolean
  lock_behavior:
    strict_lock: boolean
    soft_lock: boolean
```

### 2.11 Source/connector contract (`SourceConnector@1.0.0`)

```yaml
Source:
  source_id: string
  source_type: enum[
    uploaded_file,folder_batch,url,api,database,document,spreadsheet,
    image,presentation,future_connector
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

### 2.12 Canvas integration contract (`CanvasIntegration@1.0.0`)

```yaml
CanvasSessionState:
  session_id: string
  workspace_id: string
  tenant_ref: string
  mode_state: enum[easy,advanced]
  selected_sources: string[]
  selected_artifacts: string[]
  action_suggestions: ActionSuggestion[]
  action_execution_state: ActionExecutionState[]
  inspector_state: object
  evidence_drawer_state: object
  compare_state: object
  library_state: object
  drag_drop_payloads: DragDropPayload[]

DragDropPayload:
  payload_id: string
  payload_type: enum[source_ref,artifact_ref,asset_ref,template_ref,data_binding]
  refs: string[]
  origin: string
  target: string
  timestamp: datetime
```

### 2.13 Degrade/warning contract (`DegradePolicy@1.0.0`)

```yaml
ExecutionOutcome:
  outcome: enum[success,success_with_warnings,degraded,failed]
  warnings: Warning[]
  degraded_items: DegradedItem[]
  failed_items: FailedItem[]
  editability_after_run:
    editable_parts: string[]
    non_editable_parts: string[]
  rerun_repair:
    rerun_possible: boolean
    repair_possible: boolean
    suggested_actions: string[]
```

No silent degradation: any `degraded` or `success_with_warnings` outcome must populate reason codes and impacted refs.

### 2.14 Tenant/permission contract (`TenantPermission@1.0.0`)

```yaml
Tenant:
  tenant_ref: string
  isolation_boundary: string

Workspace:
  workspace_id: string
  tenant_ref: string

RoleBinding:
  principal_ref: string
  role: enum[owner,admin,editor,analyst,viewer,auditor,service]
  scope: enum[tenant,workspace,asset,source,artifact,audit]
  scope_ref: string

PermissionScope:
  visibility: enum[private,workspace,tenant,shared_link]
  allow_read: boolean
  allow_write: boolean
  allow_share: boolean
  allow_publish: boolean
  allow_audit_view: boolean
```

### 2.15 Output publication contract (`OutputPublication@1.0.0`)

```yaml
Publication:
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

---

## 3) Shared schemas/models

### 3.1 Required common types

```yaml
Warning:
  code: string
  message: string
  severity: enum[low,medium,high]
  ref: string

RetryPolicy:
  max_retries: integer
  backoff_ms: integer
  strategy: enum[fixed,exponential]

ValidationCheckResult:
  check_id: string
  check_name: string
  passed: boolean
  details: string

Metric:
  name: string
  value: number
  unit: string

JsonSchemaRef:
  schema_id: string
  version: semver
  uri: string
```

### 3.2 Versioning rules

1. Every contract and schema uses semantic versioning.
2. Breaking change => major version bump and migration definition.
3. Additive backward-compatible fields => minor bump.
4. Fix-only updates => patch bump.
5. Deprecated fields require two release cycles before removal.

### 3.3 Extension rules

1. Extensions must be namespaced: `x_<team>_<field>`.
2. Extensions cannot redefine mandatory fields.
3. Extensions cannot change global enums (`mode`, `outcome`, `state`).
4. Private capability fields are allowed only as optional extension metadata, never as substitutes for shared required fields.

---

## 4) Integration rules

1. All capability services must read/write shared contracts as the system of record.
2. Orchestration (jobs/actions/tools) must run through `JobLifecycle`, `ActionRuntime`, and `ToolRegistry` contracts.
3. Any output artifact must include `evidence_ref`, `verification_status`, `lineage_ref`, `permission_scope`, and `mode`.
4. Unified canvas is the only interactive shell; no detached app-shell dependencies.
5. Drag/drop interactions must carry typed `DragDropPayload` objects only.
6. Easy/Advanced mode must be present in both `Job.requested_mode` and `Artifact.mode`.
7. Strict outputs require `strict_evidence_level=strong` and non-empty validation checks.
8. Publication/export cannot bypass evidence or permission evaluation.
9. Any degraded execution must produce `ExecutionOutcome` with explicit degraded reason codes.
10. AI-suggested actions must be logged with acceptance/rejection state in lineage/audit.

---

## 5) Risks

1. **Contract drift across teams** if schema registry governance is weak.
2. **Enum fragmentation** via unreviewed extensions.
3. **Evidence under-population** creating false-positive “completed” states.
4. **Performance bottlenecks** in lineage graph queries at very high scale.
5. **Permission leakage** if publication pathways skip `PermissionScope` checks.
6. **Mode inconsistency** if UI state and backend metadata diverge.
7. **Degrade ambiguity** if reason code taxonomy is not centrally maintained.

---

## 6) Deferrals

1. Capability-specific algorithms (strict engine internals, report renderer internals, etc.).
2. UI component implementation details beyond shared canvas state contract.
3. Connector-specific authentication mechanics (kept behind `connector_ref` adapters).
4. Physical storage layout and vendor selection.
5. Scheduling/autoscaling strategy internals.

---

## 7) Acceptance gates

This shared pack is accepted only when all are true:

1. Every listed contract (canonical, artifact, lifecycle, runtime, registry, evidence, lineage, library, template/brand, source/connector, canvas, degrade, tenant/permission, publication) exists and is versioned.
2. Mandatory fields enumerated in the request are present and typed.
3. No contract references a detached mini-product shell.
4. No capability-private artifact/job/state model is required for core execution.
5. Degrade outcomes are explicit and non-silent.
6. Evidence and verification metadata are mandatory for meaningful outputs.
7. Multi-tenant and permission scope semantics are explicit and enforceable.
8. Dual-mode semantics are globally stable and represented in both jobs and artifacts.
9. Canvas integration includes drag/drop payload contract.
10. Contract extension policy prevents incompatible forks.

---

## 8) First implementation milestone for the shared pack

### Milestone M1 — “Contract Freeze + Registry Bootstrap”

Deliverables:
1. Publish all contracts above as machine-readable schemas in a single schema registry namespace.
2. Implement schema validation middleware for write paths: source ingest, job updates, action execution, artifact publish.
3. Add contract conformance tests:
   - required field presence tests,
   - enum validity tests,
   - backward compatibility tests for future updates.
4. Enable audit hooks for action execution and AI decision logging.
5. Block non-conformant writes at API boundary.

Exit criteria:
1. A sample end-to-end run (source -> job -> artifact -> evidence -> publication) validates against all relevant schemas.
2. No service endpoint can persist artifact/job/action entities outside shared contracts.
3. Degraded and warning outcomes are observable in API responses and canvas state.
