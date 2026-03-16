import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ActionRegistry,
  AuditEventSchema,
  GOVERNANCE_CAPABILITY_ID,
  GOVERNANCE_CONTRACT,
  GovernanceActionRegistry,
  GovernanceApprovalRecordSchema,
  GovernanceApprovalWorkflowSchema,
  GovernanceDiffArtifactSchema,
  GovernanceExecutionEnvelopeSchema,
  GovernanceEvidenceRecordSchema,
  GovernanceEvidenceAttachmentSchema,
  GovernanceKpiDefinitionSchema,
  GovernanceLibraryRecordSchema,
  GovernancePromptScanSchema,
  GovernanceRegistryEntrySchema,
  GovernanceComplianceRecordSchema,
  GovernancePermissionDefinitionSchema,
  GovernancePolicyDecisionSchema,
  GovernancePolicyRuleSchema,
  GovernanceQueueControlSchema,
  GovernanceReplayBundleSchema,
  GovernanceRoleAssignmentSchema,
  GovernanceRoleDefinitionSchema,
  GovernanceSecuritySurfaceSchema,
  GovernanceVersionRecordSchema,
  LineageEdgeSchema,
  LibraryAssetSchema,
  contractEnvelope,
  type ActionDefinition,
  type AuditEvent,
  type GovernanceApprovalRecord,
  type GovernanceApprovalWorkflow,
  type GovernanceDiffArtifact,
  type GovernanceExecutionEnvelope,
  type GovernanceEvidenceRecord,
  type GovernanceEvidenceAttachment,
  type GovernanceKpiDefinition,
  type GovernanceLibraryRecord,
  type GovernancePromptScan,
  type GovernanceRegistryEntry,
  type GovernanceComplianceRecord,
  type GovernancePermissionDefinition,
  type GovernancePolicyDecision,
  type GovernancePolicyRule,
  type GovernancePriorityClass,
  type GovernanceQueueControl,
  type GovernanceReplayBundle,
  type GovernanceResourceKind,
  type GovernanceRoleAssignment,
  type GovernanceRoleDefinition,
  type GovernanceSecuritySurface,
  type GovernanceVersionRecord,
  type LibraryAsset,
  type LineageEdge,
  type PlatformMode,
  type VersionRef
} from "@rasid/contracts";

const now = (): string => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const excerpt = (value: string, limit = 240): string => (value.length <= limit ? value : `${value.slice(0, limit)}...`);
const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== null && part !== undefined && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9:_-]+/g, "-");

type JsonRecord = Record<string, unknown>;

type GovernancePreflightPrompt = {
  text: string;
  context?: string;
};

type GovernancePreflightCompliance = {
  values: unknown;
  regulations?: string[];
};

type GovernancePromptThreatInput = {
  type: "injection" | "jailbreak" | "data_extraction" | "role_manipulation";
  severity: "low" | "medium" | "high" | "critical";
  pattern: string;
  position: number;
};

type GovernancePreflightOutcome = {
  blocked: boolean;
  requireApproval: boolean;
  reasons: string[];
  promptScan: GovernancePromptScan | null;
  complianceRecord: GovernanceComplianceRecord | null;
};

export type GovernanceActorContext = {
  actor_ref: string;
  tenant_ref: string;
  workspace_id: string;
  page_path: string;
  requested_mode?: PlatformMode;
  department?: string;
  owner_ref?: string;
  sensitivity?: "public" | "internal" | "confidential" | "restricted";
  asset_type?: string;
  ip_address?: string;
  two_factor_verified?: boolean;
};

export type GovernanceExecutionInput<T> = {
  action_id: string;
  actor: GovernanceActorContext;
  resource_kind: GovernanceResourceKind;
  resource_ref: string;
  source_refs?: string[];
  target_refs?: string[];
  priority_class?: GovernancePriorityClass;
  input_payload: JsonRecord;
  approval_granted?: boolean;
  approval_note?: string;
  preflight?: {
    prompt?: GovernancePreflightPrompt;
    compliance?: GovernancePreflightCompliance;
  };
  delegate: () => GovernanceExecutionResultPayload<T> | Promise<GovernanceExecutionResultPayload<T>>;
};

export type GovernanceExecutionResultPayload<T> = {
  result: T;
  target_refs?: string[];
  output_summary?: JsonRecord;
  version_ref?: VersionRef | null;
  previous_version_id?: string | null;
  diff_source?: { left: unknown; right: unknown; left_ref: string; right_ref: string; summary?: string } | null;
  library_record?: GovernanceLibraryRecord | null;
  kpi_record?: GovernanceKpiDefinition | null;
};

export type GovernanceExecutionResult<T> = {
  status: "executed" | "denied" | "approval_required";
  decision: GovernancePolicyDecision;
  audit_event: AuditEvent;
  lineage_edges: LineageEdge[];
  approval: GovernanceApprovalRecord | null;
  version_record: GovernanceVersionRecord | null;
  diff_artifact: GovernanceDiffArtifact | null;
  replay_bundle: GovernanceReplayBundle | null;
  queue_control: GovernanceQueueControl;
  result: T | null;
};

type GovernanceTenantSnapshot = {
  permissions: GovernancePermissionDefinition[];
  roles: GovernanceRoleDefinition[];
  assignments: GovernanceRoleAssignment[];
  policies: GovernancePolicyRule[];
  decisions: GovernancePolicyDecision[];
  approvals: GovernanceApprovalRecord[];
  workflows: GovernanceApprovalWorkflow[];
  audits: AuditEvent[];
  lineages: LineageEdge[];
  versions: GovernanceVersionRecord[];
  diffs: GovernanceDiffArtifact[];
  replays: GovernanceReplayBundle[];
  kpis: GovernanceKpiDefinition[];
  library: GovernanceLibraryRecord[];
  evidence_records: GovernanceEvidenceRecord[];
  prompt_scans: GovernancePromptScan[];
  compliance_checks: GovernanceComplianceRecord[];
  queues: GovernanceQueueControl[];
  workflow_templates: JsonRecord[];
  security: GovernanceSecuritySurface;
};

const defaultGovernanceSecuritySurface = (tenantRef: string): GovernanceSecuritySurface =>
  GovernanceSecuritySurfaceSchema.parse({
    contract: GOVERNANCE_CONTRACT,
    schema_namespace: "rasid.shared.governance.v1",
    schema_version: "1.0.0",
    surface_id: id("security", tenantRef),
    tenant_ref: tenantRef,
    auth_mode: "password_session",
    password_policy: {
      minimum_length: 12,
      require_uppercase: true,
      require_numeric: true
    },
    session_policy: {
      max_idle_minutes: 45,
      ip_pinning: true,
      require_2fa_for_sensitive_actions: true
    },
    rate_limit: {
      window_seconds: 60,
      max_requests: 30
    },
    backup_policy: {
      enabled: true,
      cadence: "daily",
      disaster_recovery_tier: "local-proof"
    }
  });

const permission = (
  permissionId: string,
  label: string,
  description: string,
  action: "view" | "edit" | "approve" | "publish" | "delete" | "schedule" | "run_ai" | "run_strict_replication" | "manage_templates" | "manage_library" | "manage_governance" | "review" | "create" | "update",
  resourceKind: GovernanceResourceKind
): GovernancePermissionDefinition =>
  GovernancePermissionDefinitionSchema.parse({
    contract: GOVERNANCE_CONTRACT,
    schema_namespace: "rasid.shared.governance.v1",
    schema_version: "1.0.0",
    permission_id: permissionId,
    label,
    description,
    action,
    resource_kind: resourceKind,
    built_in: true
  });

const basePermissions = (): GovernancePermissionDefinition[] => [
  permission("source:read", "Read Source", "Read governed source datasets.", "view", "dataset"),
  permission("dataset:write", "Write Dataset", "Register or update governed datasets.", "edit", "dataset"),
  permission("artifact:write", "Write Artifact", "Create or update governed artifacts.", "edit", "artifact"),
  permission("artifact:read", "Read Artifact", "Read governed artifacts.", "view", "artifact"),
  permission("dashboard:read", "Read Dashboard", "View dashboards.", "view", "dashboard"),
  permission("dashboard:write", "Write Dashboard", "Mutate dashboards.", "edit", "dashboard"),
  permission("report:read", "Read Report", "View reports.", "view", "report"),
  permission("report:write", "Write Report", "Mutate reports.", "edit", "report"),
  permission("report:approve", "Approve Report", "Approve report changes.", "approve", "report"),
  permission("presentation:write", "Write Presentation", "Mutate presentations.", "edit", "presentation"),
  permission("publication:write", "Publish", "Publish governed outputs.", "publish", "publication"),
  permission("publication:share", "Share Publication", "Create governed share links.", "publish", "publication"),
  permission("publication:schedule", "Schedule Publish", "Schedule governed publication.", "schedule", "schedule"),
  permission("schedule:write", "Write Schedule", "Manage schedules.", "schedule", "schedule"),
  permission("library:read", "Read Library", "Read governed library assets.", "view", "library_asset"),
  permission("library:write", "Write Library", "Create or update governed library assets.", "manage_library", "library_asset"),
  permission("template:read", "Read Template", "Read templates.", "view", "template"),
  permission("template:write", "Write Template", "Manage templates.", "manage_templates", "template"),
  permission("audit:read", "Read Audit", "Read audit trails.", "view", "governance_surface"),
  permission("approval:review", "Review Approval", "Review approval requests.", "review", "approval_request"),
  permission("approval:approve", "Approve Boundary", "Approve or reject governed changes.", "approve", "approval_request"),
  permission("kpi:write", "Write KPI", "Manage KPI registry definitions.", "edit", "kpi_definition"),
  permission("policy:write", "Write Policy", "Manage ABAC policies.", "manage_governance", "policy_rule"),
  permission("permission:write", "Write Permission", "Manage roles and permissions.", "manage_governance", "role"),
  permission("governance:manage", "Manage Governance", "Administer governance surfaces.", "manage_governance", "governance_surface"),
  permission("ai:execute", "Execute AI", "Run governed AI actions.", "run_ai", "ai"),
  permission("strict:execute", "Execute Strict", "Run strict replication actions.", "run_strict_replication", "replication")
];

const allowAllScope = {
  visibility: "tenant" as const,
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
};

const defaultRoles = (tenantRef: string): GovernanceRoleDefinition[] => {
  const all = basePermissions().map((entry) => entry.permission_id);
  const readOnly = all.filter((entry) => entry.endsWith(":read") || entry === "audit:read");
  const editor = [
    "source:read",
    "dataset:write",
    "artifact:write",
    "artifact:read",
    "dashboard:read",
    "dashboard:write",
    "report:read",
    "report:write",
    "presentation:write",
    "library:read",
    "library:write",
    "template:read",
    "template:write",
    "publication:schedule",
    "schedule:write",
    "ai:execute"
  ];
  return [
    { role_id: "owner", name: "Owner", description: "Full tenant governance control.", permission_ids: all, built_in: true, permission_scope: allowAllScope },
    { role_id: "admin", name: "Admin", description: "Governance administrator.", permission_ids: all.filter((entry) => entry !== "strict:execute"), built_in: true, permission_scope: allowAllScope },
    { role_id: "editor", name: "Editor", description: "Writes governed content but cannot approve or change policies.", permission_ids: editor, built_in: true, permission_scope: { ...allowAllScope, allow_audit_view: false } },
    {
      role_id: "viewer",
      name: "Viewer",
      description: "Read-only governed access.",
      permission_ids: readOnly,
      built_in: true,
      permission_scope: { visibility: "workspace", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: false }
    },
    {
      role_id: "auditor",
      name: "Auditor",
      description: "Reads audit, lineage, approvals, and versions.",
      permission_ids: ["audit:read", "artifact:read", "library:read", "dashboard:read", "report:read"],
      built_in: true,
      permission_scope: { visibility: "tenant", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: true }
    },
    { role_id: "ai_operator", name: "AI Operator", description: "Runs governed AI with approval boundaries.", permission_ids: ["ai:execute", "artifact:write", "artifact:read", "audit:read"], built_in: true, permission_scope: { ...allowAllScope, allow_publish: false } },
    { role_id: "strict_operator", name: "Strict Operator", description: "Runs governed strict replication flows.", permission_ids: ["strict:execute", "artifact:write", "artifact:read", "audit:read"], built_in: true, permission_scope: { ...allowAllScope, allow_publish: false } }
  ].map((role) =>
    GovernanceRoleDefinitionSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      tenant_ref: tenantRef,
      group_refs: [],
      ...role
    })
  );
};

const defaultAssignments = (tenantRef: string): GovernanceRoleAssignment[] =>
  [
    { principal_ref: "admin", role_id: "owner" },
    { principal_ref: "dashboard-web", role_id: "admin" },
    { principal_ref: "dashboard-web-ai", role_id: "ai_operator" },
    { principal_ref: "dashboard-web-ai-approval", role_id: "admin" }
  ].map((entry) =>
    GovernanceRoleAssignmentSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      assignment_id: id("assignment", tenantRef, entry.principal_ref, entry.role_id),
      tenant_ref: tenantRef,
      principal_ref: entry.principal_ref,
      role_id: entry.role_id,
      workspace_id: null,
      asset_ref: null,
      granted_by: "system",
      granted_at: now(),
      attributes: { tenant_ref: tenantRef }
    })
  );

const defaultPolicies = (tenantRef: string): GovernancePolicyRule[] =>
  [
    { policy_id: "policy-sensitive-approval", name: "Sensitive actions require approval", description: "Confidential writes require approval.", priority: 100, effect: "require_approval", conditions: { data_sensitivity: "confidential" }, reason_template: "Sensitive governed change requires approval." },
    { policy_id: "policy-restricted-approval", name: "Restricted actions require approval", description: "Restricted writes require approval.", priority: 110, effect: "require_approval", conditions: { data_sensitivity: "restricted" }, reason_template: "Restricted governed change requires approval." },
    { policy_id: "policy-governance-2fa", name: "Governance admin requires 2FA", description: "Governance management requires a verified second factor.", priority: 120, effect: "deny", conditions: { resource_kind: "governance_surface", require_2fa: true }, reason_template: "Governance administration requires 2FA." }
  ].map((entry) =>
    GovernancePolicyRuleSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      tenant_ref: tenantRef,
      enabled: true,
      ...entry
    })
  );

const defaultApprovalWorkflows = (tenantRef: string): GovernanceApprovalWorkflow[] =>
  [
    { workflow_id: "workflow-publish", name: "Publish Boundary", resource_kind: "publication", action_id: "dashboard.publish.v1", stages: [{ stage_id: "review", label: "Review", approver_role_ids: ["admin", "owner"], minimum_approvals: 1 }] },
    { workflow_id: "workflow-share", name: "Share Boundary", resource_kind: "publication", action_id: "governance.publication.share.v1", stages: [{ stage_id: "review-share", label: "Review Share", approver_role_ids: ["admin", "owner"], minimum_approvals: 1 }] },
    { workflow_id: "workflow-ai", name: "AI Editable Apply Boundary", resource_kind: "ai", action_id: "governance.ai.execute.v1", stages: [{ stage_id: "approve-ai", label: "Approve AI", approver_role_ids: ["admin", "owner", "ai_operator"], minimum_approvals: 1 }] },
    { workflow_id: "workflow-strict", name: "Strict Boundary", resource_kind: "replication", action_id: "governance.strict.execute.v1", stages: [{ stage_id: "approve-strict", label: "Approve Strict", approver_role_ids: ["admin", "owner", "strict_operator"], minimum_approvals: 1 }] },
    { workflow_id: "workflow-kpi", name: "KPI Governance Boundary", resource_kind: "kpi_definition", action_id: "governance.kpi.upsert.v1", stages: [{ stage_id: "approve-kpi", label: "Approve KPI", approver_role_ids: ["admin", "owner"], minimum_approvals: 1 }] }
  ].map((entry) =>
    GovernanceApprovalWorkflowSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      tenant_ref: tenantRef,
      active: true,
      ...entry
    })
  );

const summarizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 2) {
    return Array.isArray(value) ? `[array:${value.length}]` : value && typeof value === "object" ? "[object]" : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((entry) => summarizeValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).slice(0, 12).map(([key, entry]) => [key, summarizeValue(entry, depth + 1)]));
  }
  return value;
};

const diffObjects = (left: unknown, right: unknown, prefix = ""): string[] => {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return [];
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) {
    return [prefix || "root"];
  }
  const keys = [...new Set([...Object.keys(left as JsonRecord), ...Object.keys(right as JsonRecord)])];
  const diffs: string[] = [];
  for (const key of keys) {
    diffs.push(...diffObjects((left as JsonRecord)[key], (right as JsonRecord)[key], prefix ? `${prefix}.${key}` : key));
  }
  return [...new Set(diffs)];
};

const PROMPT_PATTERNS: Array<{
  regex: RegExp;
  type: GovernancePromptThreatInput["type"];
  severity: GovernancePromptThreatInput["severity"];
  label: string;
}> = [
  { regex: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules|context)/i, type: "injection", severity: "critical", label: "ignore previous instructions" },
  { regex: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i, type: "injection", severity: "critical", label: "disregard instructions" },
  { regex: /forget\s+(everything|all|your)\s+(you|instructions|rules|previous)/i, type: "injection", severity: "critical", label: "forget instructions" },
  { regex: /override\s+(your|all|the)\s+(instructions|rules|constraints|guidelines)/i, type: "injection", severity: "critical", label: "override instructions" },
  { regex: /\[SYSTEM\]|<<\s*SYS\s*>>/i, type: "injection", severity: "critical", label: "system block injection" },
  { regex: /you\s+are\s+now\s+/i, type: "jailbreak", severity: "high", label: "role reassignment" },
  { regex: /pretend\s+(you\s+are|to\s+be|you're)/i, type: "jailbreak", severity: "high", label: "pretend directive" },
  { regex: /act\s+as\s+(if\s+you\s+are|a|an)\s+/i, type: "jailbreak", severity: "high", label: "act as directive" },
  { regex: /jailbreak|do\s+anything\s+now/i, type: "jailbreak", severity: "critical", label: "explicit jailbreak" },
  { regex: /system\s+prompt|reveal\s+(your|the)\s+(instructions|prompt|rules|system)/i, type: "data_extraction", severity: "high", label: "instruction reveal" },
  { regex: /you\s+don'?t\s+have\s+(to|any)\s+(follow|rules|restrictions)/i, type: "role_manipulation", severity: "high", label: "rule dismissal" }
];

const PROMPT_HOMOGLYPHS = new Map<string, string>([
  ["\u0410", "A"],
  ["\u0412", "B"],
  ["\u0421", "C"],
  ["\u0415", "E"],
  ["\u041D", "H"],
  ["\u041A", "K"],
  ["\u041C", "M"],
  ["\u041E", "O"],
  ["\u0420", "P"],
  ["\u0422", "T"],
  ["\u0425", "X"],
  ["\u0430", "a"],
  ["\u0435", "e"],
  ["\u043E", "o"],
  ["\u0440", "p"],
  ["\u0441", "c"],
  ["\u0443", "y"],
  ["\u0445", "x"],
  ["\u200B", ""],
  ["\u200C", ""],
  ["\u200D", ""],
  ["\uFEFF", ""]
]);

const normalizePrompt = (value: string): string =>
  [...value]
    .map((character) => PROMPT_HOMOGLYPHS.get(character) ?? character)
    .join("")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const extractEncodedVariants = (value: string): string[] => {
  const variants = new Set<string>();
  const compact = value.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]{24,}$/.test(compact)) {
    try {
      variants.add(Buffer.from(compact, "base64").toString("utf8"));
    } catch {}
  }
  if (/^(?:0x)?[0-9a-fA-F]{24,}$/.test(compact)) {
    try {
      const normalized = compact.startsWith("0x") ? compact.slice(2) : compact;
      variants.add(Buffer.from(normalized, "hex").toString("utf8"));
    } catch {}
  }
  return [...variants].filter(Boolean);
};

const promptRiskScore = (threats: GovernancePromptThreatInput[]): number => {
  const weights = { low: 10, medium: 25, high: 45, critical: 70 } as const;
  return Math.min(100, threats.reduce((sum, threat) => sum + weights[threat.severity], 0));
};

const flattenScalars = (value: unknown, pathPrefix = ""): Array<{ path: string; value: string }> => {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [{ path: pathPrefix || "root", value: String(value) }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenScalars(entry, `${pathPrefix}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value as JsonRecord).flatMap(([key, entry]) => flattenScalars(entry, pathPrefix ? `${pathPrefix}.${key}` : key));
  }
  return [];
};

const summarizeIssueCount = (issues: Array<{ severity: "low" | "medium" | "high" | "critical" }>) =>
  issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.severity] = (accumulator[issue.severity] ?? 0) + 1;
    return accumulator;
  }, {});

export const defaultGovernanceStorageRoot = (root = process.cwd()): string => path.join(root, ".runtime", "governance-engine");

export class GovernanceEngineStore {
  readonly rootDir: string;

  constructor(rootDir = defaultGovernanceStorageRoot()) {
    this.rootDir = rootDir;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private tenantRoot(tenantRef: string): string {
    return path.join(this.rootDir, "tenants", tenantRef);
  }

  private tenantFile(tenantRef: string, fileName: string): string {
    return path.join(this.tenantRoot(tenantRef), fileName);
  }

  private readArray<T>(tenantRef: string, fileName: string, fallback: T[]): T[] {
    const filePath = this.tenantFile(tenantRef, fileName);
    if (!fs.existsSync(filePath)) {
      return clone(fallback);
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return this.writeArray(tenantRef, fileName, clone(fallback));
    }
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return this.writeArray(tenantRef, fileName, clone(fallback));
    }
  }

  private writeArray<T>(tenantRef: string, fileName: string, payload: T[]): T[] {
    fs.mkdirSync(this.tenantRoot(tenantRef), { recursive: true });
    fs.writeFileSync(this.tenantFile(tenantRef, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
  }

  private readObject<T>(tenantRef: string, fileName: string, fallback: T): T {
    const filePath = this.tenantFile(tenantRef, fileName);
    if (!fs.existsSync(filePath)) {
      return clone(fallback);
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return this.writeObject(tenantRef, fileName, clone(fallback));
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return this.writeObject(tenantRef, fileName, clone(fallback));
    }
  }

  private writeObject<T>(tenantRef: string, fileName: string, payload: T): T {
    fs.mkdirSync(this.tenantRoot(tenantRef), { recursive: true });
    fs.writeFileSync(this.tenantFile(tenantRef, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
  }

  ensureTenant(tenantRef: string): GovernanceTenantSnapshot {
    const snapshot: GovernanceTenantSnapshot = {
      permissions: this.readArray(tenantRef, "permissions.json", basePermissions()),
      roles: this.readArray(tenantRef, "roles.json", defaultRoles(tenantRef)),
      assignments: this.readArray(tenantRef, "assignments.json", defaultAssignments(tenantRef)),
      policies: this.readArray(tenantRef, "policies.json", defaultPolicies(tenantRef)),
      decisions: this.readArray(tenantRef, "decisions.json", []),
      approvals: this.readArray(tenantRef, "approvals.json", []),
      workflows: this.readArray(tenantRef, "approval-workflows.json", defaultApprovalWorkflows(tenantRef)),
      audits: this.readArray(tenantRef, "audits.json", []),
      lineages: this.readArray(tenantRef, "lineages.json", []),
      versions: this.readArray(tenantRef, "versions.json", []),
      diffs: this.readArray(tenantRef, "diffs.json", []),
      replays: this.readArray(tenantRef, "replays.json", []),
      kpis: this.readArray(tenantRef, "kpis.json", []),
      library: this.readArray(tenantRef, "library.json", []),
      evidence_records: this.readArray(tenantRef, "evidence-records.json", []),
      prompt_scans: this.readArray(tenantRef, "prompt-scans.json", []),
      compliance_checks: this.readArray(tenantRef, "compliance-checks.json", []),
      queues: this.readArray(tenantRef, "queues.json", []),
      workflow_templates: this.readArray(tenantRef, "workflow-templates.json", []),
      security: this.readObject(tenantRef, "security.json", defaultGovernanceSecuritySurface(tenantRef))
    };
    this.writeArray(tenantRef, "permissions.json", snapshot.permissions);
    this.writeArray(tenantRef, "roles.json", snapshot.roles);
    this.writeArray(tenantRef, "assignments.json", snapshot.assignments);
    this.writeArray(tenantRef, "policies.json", snapshot.policies);
    this.writeArray(tenantRef, "approval-workflows.json", snapshot.workflows);
    this.writeArray(tenantRef, "evidence-records.json", snapshot.evidence_records);
    this.writeArray(tenantRef, "prompt-scans.json", snapshot.prompt_scans);
    this.writeArray(tenantRef, "compliance-checks.json", snapshot.compliance_checks);
    this.writeObject(tenantRef, "security.json", snapshot.security);
    return snapshot;
  }

  listPermissions(tenantRef: string): GovernancePermissionDefinition[] {
    return this.ensureTenant(tenantRef).permissions;
  }

  listRoles(tenantRef: string): GovernanceRoleDefinition[] {
    return this.ensureTenant(tenantRef).roles;
  }

  saveRole(record: GovernanceRoleDefinition): GovernanceRoleDefinition {
    const roles = this.listRoles(record.tenant_ref).filter((entry) => entry.role_id !== record.role_id);
    roles.push(GovernanceRoleDefinitionSchema.parse(record));
    this.writeArray(record.tenant_ref, "roles.json", roles);
    return record;
  }

  listAssignments(tenantRef: string): GovernanceRoleAssignment[] {
    return this.ensureTenant(tenantRef).assignments;
  }

  saveAssignment(record: GovernanceRoleAssignment): GovernanceRoleAssignment {
    const assignments = this.listAssignments(record.tenant_ref).filter((entry) => entry.assignment_id !== record.assignment_id);
    assignments.push(GovernanceRoleAssignmentSchema.parse(record));
    this.writeArray(record.tenant_ref, "assignments.json", assignments);
    return record;
  }

  listPolicies(tenantRef: string): GovernancePolicyRule[] {
    return this.ensureTenant(tenantRef).policies.sort((left, right) => right.priority - left.priority);
  }

  savePolicy(record: GovernancePolicyRule): GovernancePolicyRule {
    const policies = this.listPolicies(record.tenant_ref).filter((entry) => entry.policy_id !== record.policy_id);
    policies.push(GovernancePolicyRuleSchema.parse(record));
    this.writeArray(record.tenant_ref, "policies.json", policies);
    return record;
  }

  listDecisions(tenantRef: string): GovernancePolicyDecision[] {
    return this.ensureTenant(tenantRef).decisions;
  }

  appendDecision(record: GovernancePolicyDecision): GovernancePolicyDecision {
    const decisions = this.listDecisions(record.tenant_ref);
    decisions.push(GovernancePolicyDecisionSchema.parse(record));
    this.writeArray(record.tenant_ref, "decisions.json", decisions);
    return record;
  }

  listApprovalWorkflows(tenantRef: string): GovernanceApprovalWorkflow[] {
    return this.ensureTenant(tenantRef).workflows;
  }

  listApprovals(tenantRef: string): GovernanceApprovalRecord[] {
    return this.ensureTenant(tenantRef).approvals;
  }

  saveApproval(record: GovernanceApprovalRecord): GovernanceApprovalRecord {
    const approvals = this.listApprovals(record.tenant_ref).filter((entry) => entry.approval_id !== record.approval_id);
    approvals.push(GovernanceApprovalRecordSchema.parse(record));
    this.writeArray(record.tenant_ref, "approvals.json", approvals);
    return record;
  }

  listAuditEvents(tenantRef: string): AuditEvent[] {
    return this.ensureTenant(tenantRef).audits;
  }

  appendAuditEvent(tenantRef: string, event: AuditEvent): AuditEvent {
    const events = this.listAuditEvents(tenantRef);
    events.push(AuditEventSchema.parse(event));
    this.writeArray(tenantRef, "audits.json", events);
    return event;
  }

  listLineageEdges(tenantRef: string): LineageEdge[] {
    return this.ensureTenant(tenantRef).lineages;
  }

  appendLineageEdges(tenantRef: string, edges: LineageEdge[]): LineageEdge[] {
    const lineages = this.listLineageEdges(tenantRef);
    const parsed = edges.map((entry) => LineageEdgeSchema.parse(entry));
    lineages.push(...parsed);
    this.writeArray(tenantRef, "lineages.json", lineages);
    return parsed;
  }

  listVersions(tenantRef: string): GovernanceVersionRecord[] {
    return this.ensureTenant(tenantRef).versions;
  }

  saveVersion(record: GovernanceVersionRecord): GovernanceVersionRecord {
    const versions = this.listVersions(record.tenant_ref).filter((entry) => entry.version_record_id !== record.version_record_id);
    versions.push(GovernanceVersionRecordSchema.parse(record));
    this.writeArray(record.tenant_ref, "versions.json", versions);
    return record;
  }

  listDiffs(tenantRef: string): GovernanceDiffArtifact[] {
    return this.ensureTenant(tenantRef).diffs;
  }

  saveDiff(record: GovernanceDiffArtifact): GovernanceDiffArtifact {
    const diffs = this.listDiffs(record.tenant_ref).filter((entry) => entry.diff_id !== record.diff_id);
    diffs.push(GovernanceDiffArtifactSchema.parse(record));
    this.writeArray(record.tenant_ref, "diffs.json", diffs);
    return record;
  }

  listReplays(tenantRef: string): GovernanceReplayBundle[] {
    return this.ensureTenant(tenantRef).replays;
  }

  saveReplay(record: GovernanceReplayBundle): GovernanceReplayBundle {
    const replays = this.listReplays(record.tenant_ref).filter((entry) => entry.replay_id !== record.replay_id);
    replays.push(GovernanceReplayBundleSchema.parse(record));
    this.writeArray(record.tenant_ref, "replays.json", replays);
    return record;
  }

  listKpis(tenantRef: string): GovernanceKpiDefinition[] {
    return this.ensureTenant(tenantRef).kpis;
  }

  saveKpi(record: GovernanceKpiDefinition): GovernanceKpiDefinition {
    const kpis = this.listKpis(record.tenant_ref).filter((entry) => entry.kpi_id !== record.kpi_id);
    kpis.push(GovernanceKpiDefinitionSchema.parse(record));
    this.writeArray(record.tenant_ref, "kpis.json", kpis);
    return record;
  }

  listLibraryRecords(tenantRef: string): GovernanceLibraryRecord[] {
    return this.ensureTenant(tenantRef).library;
  }

  saveLibraryRecord(record: GovernanceLibraryRecord): GovernanceLibraryRecord {
    const library = this.listLibraryRecords(record.tenant_ref).filter((entry) => entry.asset_id !== record.asset_id);
    library.push(GovernanceLibraryRecordSchema.parse(record));
    this.writeArray(record.tenant_ref, "library.json", library);
    return record;
  }

  listEvidenceRecords(tenantRef: string): GovernanceEvidenceRecord[] {
    return this.ensureTenant(tenantRef).evidence_records;
  }

  saveEvidenceRecord(record: GovernanceEvidenceRecord): GovernanceEvidenceRecord {
    const evidence = this.listEvidenceRecords(record.tenant_ref).filter((entry) => entry.evidence_id !== record.evidence_id);
    evidence.push(GovernanceEvidenceRecordSchema.parse(record));
    this.writeArray(record.tenant_ref, "evidence-records.json", evidence);
    return record;
  }

  listPromptScans(tenantRef: string): GovernancePromptScan[] {
    return this.ensureTenant(tenantRef).prompt_scans;
  }

  savePromptScan(record: GovernancePromptScan): GovernancePromptScan {
    const scans = this.listPromptScans(record.tenant_ref).filter((entry) => entry.scan_id !== record.scan_id);
    scans.push(GovernancePromptScanSchema.parse(record));
    this.writeArray(record.tenant_ref, "prompt-scans.json", scans);
    return record;
  }

  listComplianceChecks(tenantRef: string): GovernanceComplianceRecord[] {
    return this.ensureTenant(tenantRef).compliance_checks;
  }

  saveComplianceCheck(record: GovernanceComplianceRecord): GovernanceComplianceRecord {
    const checks = this.listComplianceChecks(record.tenant_ref).filter((entry) => entry.check_id !== record.check_id);
    checks.push(GovernanceComplianceRecordSchema.parse(record));
    this.writeArray(record.tenant_ref, "compliance-checks.json", checks);
    return record;
  }

  listQueueControls(tenantRef: string): GovernanceQueueControl[] {
    return this.ensureTenant(tenantRef).queues;
  }

  saveQueueControl(record: GovernanceQueueControl): GovernanceQueueControl {
    const queues = this.listQueueControls(record.tenant_ref).filter((entry) => entry.queue_id !== record.queue_id);
    queues.push(GovernanceQueueControlSchema.parse(record));
    this.writeArray(record.tenant_ref, "queues.json", queues);
    return record;
  }

  listWorkflowTemplates(tenantRef: string): JsonRecord[] {
    return this.ensureTenant(tenantRef).workflow_templates;
  }

  appendWorkflowTemplate(tenantRef: string, record: JsonRecord): JsonRecord {
    const templates = this.listWorkflowTemplates(tenantRef);
    templates.push(record);
    this.writeArray(tenantRef, "workflow-templates.json", templates);
    return record;
  }

  getSecuritySurface(tenantRef: string): GovernanceSecuritySurface {
    return this.ensureTenant(tenantRef).security;
  }
}

export class GovernanceEngine {
  readonly store: GovernanceEngineStore;
  private readonly rateLimitBuckets = new Map<string, string[]>();
  private readonly activeQueues = new Map<string, number>();
  private readonly evidenceCache = new Map<string, GovernanceEvidenceRecord>();

  constructor(store = new GovernanceEngineStore()) {
    this.store = store;
  }

  private actionDefinition(actionId: string): ActionDefinition | null {
    return ActionRegistry.find((entry) => entry.action_id === actionId) ?? GovernanceActionRegistry.find((entry) => entry.action_id === actionId) ?? null;
  }

  private currentPermissions(tenantRef: string, actorRef: string): string[] {
    const assignments = this.store.listAssignments(tenantRef).filter((entry) => entry.principal_ref === actorRef);
    const roles = this.store.listRoles(tenantRef);
    return [...new Set(assignments.flatMap((assignment) => roles.find((role) => role.role_id === assignment.role_id)?.permission_ids ?? []))];
  }

  private registryEntries(): GovernanceRegistryEntry[] {
    const allActions = [...ActionRegistry, ...GovernanceActionRegistry];
    return allActions.map((entry) =>
      GovernanceRegistryEntrySchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        registry_id: id("registry", entry.action_id),
        capability_id: entry.capability,
        action_id: entry.action_id,
        tool_id: null,
        route_path: null,
        required_permissions: entry.required_permissions,
        evidence_required: entry.evidence_requirements.length > 0,
        async_mode: entry.side_effects.some((effect) => effect.includes("job") || effect.includes("ai")) ? "async" : "sync",
        strict_profile: entry.degrade_policy_ref ?? "NONE",
        mutating: entry.mutability === "mutating",
        resource_kind:
          entry.action_id.includes("dashboard")
            ? "dashboard"
            : entry.action_id.includes("report")
              ? "report"
              : entry.action_id.includes("presentation")
                ? "presentation"
                : entry.action_id.includes("strict")
                  ? "replication"
                  : entry.action_id.includes("localization")
                    ? "localization"
                    : entry.action_id.includes("ai")
                      ? "ai"
                      : entry.action_id.includes("kpi")
                        ? "kpi_definition"
                        : entry.action_id.includes("library")
                          ? "library_asset"
                          : entry.action_id.includes("policy") || entry.action_id.includes("role")
                            ? "governance_surface"
                            : "artifact"
      })
    );
  }

  private scanPrompt(tenantRef: string, actionId: string, actorRef: string, prompt: GovernancePreflightPrompt): GovernancePromptScan {
    const normalized = normalizePrompt(prompt.text);
    const variants = [normalized, ...extractEncodedVariants(normalized)];
    const threats: GovernancePromptThreatInput[] = [];
    for (const variant of variants) {
      for (const pattern of PROMPT_PATTERNS) {
        const match = variant.match(pattern.regex);
        if (match && match.index !== undefined && !threats.some((entry) => entry.pattern === pattern.label)) {
          threats.push({ type: pattern.type, severity: pattern.severity, pattern: pattern.label, position: match.index });
        }
      }
    }
    if (prompt.context && prompt.context.length > 0 && /[\u0600-\u06FF]/.test(prompt.context) !== /[\u0600-\u06FF]/.test(prompt.text)) {
      threats.push({ type: "injection", severity: "low", pattern: "language switch detected", position: 0 });
    }
    const riskScore = promptRiskScore(threats);
    return this.store.savePromptScan(
      GovernancePromptScanSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        scan_id: id("prompt-scan", tenantRef, actionId, Date.now()),
        tenant_ref: tenantRef,
        action_id: actionId,
        actor_ref: actorRef,
        prompt_excerpt: excerpt(prompt.text),
        sanitized_excerpt: excerpt(normalized),
        safe: threats.length === 0,
        risk_score: riskScore,
        requires_human_review: threats.some((entry) => entry.severity === "high" || entry.severity === "critical"),
        threats,
        scanned_at: now()
      })
    );
  }

  private runCompliance(tenantRef: string, input: GovernanceExecutionInput<unknown>, compliance: GovernancePreflightCompliance): GovernanceComplianceRecord {
    const issues: Array<{
      issue_id: string;
      severity: "low" | "medium" | "high" | "critical";
      category: string;
      field_refs: string[];
      rule_ref: string;
      description: string;
      suggested_action: string;
    }> = [];
    const values = flattenScalars(compliance.values);
    const patterns: Array<{ label: string; regex: RegExp; severity: "medium" | "high"; action: string }> = [
      { label: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/, severity: "medium", action: "mask emails or justify retention" },
      { label: "phone", regex: /(\+?\d{1,4}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/, severity: "medium", action: "mask phone numbers or require approval" },
      { label: "saudi_id", regex: /\b[12]\d{9}\b/, severity: "high", action: "block until identifier handling policy is attached" },
      { label: "iban", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/, severity: "high", action: "remove financial identifiers or require approval" }
    ];
    for (const entry of values) {
      for (const pattern of patterns) {
        if (pattern.regex.test(entry.value)) {
          issues.push({
            issue_id: id("compliance-issue", pattern.label, entry.path),
            severity: pattern.severity,
            category: "pii_detection",
            field_refs: [entry.path],
            rule_ref: `pii:${pattern.label}`,
            description: `Detected ${pattern.label} in ${entry.path}`,
            suggested_action: pattern.action
          });
        }
      }
    }
    const blocked = issues.some((issue) => issue.severity === "high" || issue.severity === "critical");
    const status = blocked ? "blocked" : issues.length > 0 ? "needs_review" : "compliant";
    const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === "high" ? 35 : issue.severity === "critical" ? 50 : issue.severity === "medium" ? 15 : 5), 0));
    return this.store.saveComplianceCheck(
      GovernanceComplianceRecordSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        check_id: id("compliance", tenantRef, input.action_id, Date.now()),
        tenant_ref: tenantRef,
        action_id: input.action_id,
        actor_ref: input.actor.actor_ref,
        resource_kind: input.resource_kind,
        resource_ref: input.resource_ref,
        status,
        score,
        regulations: compliance.regulations ?? ["pdpl", "internal_governance"],
        issue_count: issues.length,
        issues,
        checked_at: now(),
        summary: { issue_counts: summarizeIssueCount(issues), values_scanned: values.length }
      })
    );
  }

  private evaluatePreflight(input: GovernanceExecutionInput<unknown>): GovernancePreflightOutcome {
    const reasons: string[] = [];
    let blocked = false;
    let requireApproval = false;
    let promptScan: GovernancePromptScan | null = null;
    let complianceRecord: GovernanceComplianceRecord | null = null;
    if (input.preflight?.prompt?.text) {
      promptScan = this.scanPrompt(input.actor.tenant_ref, input.action_id, input.actor.actor_ref, input.preflight.prompt);
      if (!promptScan.safe) {
        reasons.push(`prompt_risk:${promptScan.risk_score}`);
        blocked = promptScan.threats.some((entry) => entry.severity === "critical");
        requireApproval ||= promptScan.requires_human_review;
      }
    }
    if (input.preflight?.compliance) {
      complianceRecord = this.runCompliance(input.actor.tenant_ref, input, input.preflight.compliance);
      if (complianceRecord.status === "blocked") {
        blocked = true;
        reasons.push("compliance_blocked");
      } else if (complianceRecord.status === "needs_review") {
        requireApproval = true;
        reasons.push("compliance_review_required");
      }
    }
    return { blocked, requireApproval, reasons, promptScan, complianceRecord };
  }

  private matchPolicy(policy: GovernancePolicyRule, input: GovernanceExecutionInput<unknown>): boolean {
    const conditions = policy.conditions;
    const actor = input.actor;
    return (
      (!conditions.tenant_ref || conditions.tenant_ref === actor.tenant_ref) &&
      (!conditions.workspace_id || conditions.workspace_id === actor.workspace_id) &&
      (!conditions.department || conditions.department === actor.department) &&
      (!conditions.data_sensitivity || conditions.data_sensitivity === actor.sensitivity) &&
      (!conditions.resource_kind || conditions.resource_kind === input.resource_kind) &&
      (!conditions.owner_ref || conditions.owner_ref === actor.owner_ref) &&
      (!conditions.asset_type || conditions.asset_type === actor.asset_type) &&
      (!conditions.require_2fa || actor.two_factor_verified === true) &&
      (!conditions.ip_prefix || (actor.ip_address ?? "").startsWith(conditions.ip_prefix))
    );
  }

  private resolveApprovalNeed(action: ActionDefinition | null, input: GovernanceExecutionInput<unknown>, permissionsSatisfied: boolean, matchedPolicies: GovernancePolicyRule[]): boolean {
    if (!permissionsSatisfied) {
      return false;
    }
    if (matchedPolicies.some((entry) => entry.effect === "require_approval")) {
      return true;
    }
    if (action?.approval_policy === "always") {
      return true;
    }
    if (action?.approval_policy === "conditional") {
      const sensitive = input.actor.sensitivity === "confidential" || input.actor.sensitivity === "restricted";
      const highImpactAction =
        input.action_id.includes(".publish.") ||
        input.action_id.includes(".approve.") ||
        input.action_id.includes(".schedule.") ||
        input.action_id.includes(".ai.") ||
        input.action_id.includes(".strict.");
      return sensitive || highImpactAction;
    }
    return false;
  }

  private reserveQueue(input: GovernanceExecutionInput<unknown>): GovernanceQueueControl {
    const queueId = id("queue", input.actor.tenant_ref, input.action_id);
    const activeKey = `${input.actor.tenant_ref}:${input.action_id}`;
    const currentActive = this.activeQueues.get(activeKey) ?? 0;
    const priorityClass = input.priority_class ?? "P2";
    const concurrentLimit = priorityClass === "P0" ? 1 : priorityClass === "P1" ? 2 : 3;
    const pressureState = currentActive >= concurrentLimit ? "degraded" : currentActive >= Math.max(1, concurrentLimit - 1) ? "constrained" : "normal";
    const queue = GovernanceQueueControlSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      queue_id: queueId,
      tenant_ref: input.actor.tenant_ref,
      action_id: input.action_id,
      priority_class: priorityClass,
      concurrent_limit: concurrentLimit,
      fallback_policy: pressureState === "degraded" ? "serialize" : "direct",
      pressure_state: pressureState,
      last_updated_at: now()
    });
    this.store.saveQueueControl(queue);
    this.activeQueues.set(activeKey, currentActive + 1);
    return queue;
  }

  private releaseQueue(input: GovernanceExecutionInput<unknown>): void {
    const activeKey = `${input.actor.tenant_ref}:${input.action_id}`;
    const currentActive = this.activeQueues.get(activeKey) ?? 1;
    this.activeQueues.set(activeKey, Math.max(0, currentActive - 1));
  }

  private enforceRateLimit(input: GovernanceExecutionInput<unknown>): void {
    const security = this.store.getSecuritySurface(input.actor.tenant_ref);
    const bucketKey = `${input.actor.tenant_ref}:${input.actor.actor_ref}`;
    const current = this.rateLimitBuckets.get(bucketKey) ?? [];
    const windowStart = Date.now() - security.rate_limit.window_seconds * 1000;
    const next = current.filter((entry) => new Date(entry).getTime() >= windowStart);
    if (next.length >= security.rate_limit.max_requests) {
      throw new Error("rate_limit_exceeded");
    }
    next.push(now());
    this.rateLimitBuckets.set(bucketKey, next);
  }

  authorize(input: GovernanceExecutionInput<unknown>): GovernancePolicyDecision {
    this.store.ensureTenant(input.actor.tenant_ref);
    this.enforceRateLimit(input);
    const action = this.actionDefinition(input.action_id);
    const preflight = this.evaluatePreflight(input);
    const requiredPermissions = action?.required_permissions ?? [];
    const grantedPermissions = this.currentPermissions(input.actor.tenant_ref, input.actor.actor_ref);
    const missingPermissions = requiredPermissions.filter((entry) => !grantedPermissions.includes(entry));
    const matchedPolicies = this.store.listPolicies(input.actor.tenant_ref).filter((entry) => this.matchPolicy(entry, input));
    const deniedByPolicy = matchedPolicies.find((entry) => entry.effect === "deny");
    const approvalRequired = this.resolveApprovalNeed(action, input, missingPermissions.length === 0 && !deniedByPolicy, matchedPolicies) || preflight.requireApproval;
    const assignments = this.store.listAssignments(input.actor.tenant_ref).filter((entry) => entry.principal_ref === input.actor.actor_ref);
    const decision = GovernancePolicyDecisionSchema.parse({
      contract: GOVERNANCE_CONTRACT,
      schema_namespace: "rasid.shared.governance.v1",
      schema_version: "1.0.0",
      decision_id: id("decision", input.actor.tenant_ref, input.action_id, Date.now()),
      tenant_ref: input.actor.tenant_ref,
      workspace_id: input.actor.workspace_id,
      actor_ref: input.actor.actor_ref,
      action_id: input.action_id,
      resource_kind: input.resource_kind,
      resource_ref: input.resource_ref,
      decision: deniedByPolicy || missingPermissions.length > 0 || preflight.blocked ? "denied" : approvalRequired ? "approval_required" : "allowed",
      matched_role_ids: assignments.map((entry) => entry.role_id),
      matched_policy_ids: matchedPolicies.map((entry) => entry.policy_id),
      missing_permissions: missingPermissions,
      reasons: [
        ...(deniedByPolicy ? [deniedByPolicy.reason_template] : []),
        ...(missingPermissions.length > 0 ? [`missing_permissions:${missingPermissions.join(",")}`] : []),
        ...preflight.reasons,
        ...(approvalRequired ? ["approval_boundary_required"] : ["permission_boundary_passed"])
      ],
      evaluated_at: now(),
      priority_class: input.priority_class ?? "P2",
      mode: input.actor.requested_mode ?? "advanced",
      evidence_required: true
    });
    return this.store.appendDecision(decision);
  }

  createApproval(input: GovernanceExecutionInput<unknown>): GovernanceApprovalRecord {
    const workflow =
      this.store.listApprovalWorkflows(input.actor.tenant_ref).find((entry) => entry.action_id === input.action_id) ??
      this.store.listApprovalWorkflows(input.actor.tenant_ref).find((entry) => entry.resource_kind === input.resource_kind) ??
      GovernanceApprovalWorkflowSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        workflow_id: id("workflow", input.resource_kind),
        tenant_ref: input.actor.tenant_ref,
        name: `${input.resource_kind} approval`,
        resource_kind: input.resource_kind,
        action_id: input.action_id,
        stages: [{ stage_id: "default", label: "Default Approval", approver_role_ids: ["admin", "owner"], minimum_approvals: 1 }],
        active: true
      });
    return this.store.saveApproval(
      GovernanceApprovalRecordSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        approval_id: id("approval", input.actor.tenant_ref, input.action_id, Date.now()),
        tenant_ref: input.actor.tenant_ref,
        workflow_id: workflow.workflow_id,
        action_id: input.action_id,
        resource_kind: input.resource_kind,
        resource_ref: input.resource_ref,
        requested_by: input.actor.actor_ref,
        requested_at: now(),
        status: "pending",
        stage_index: 0,
        decisions: [],
        boundary_label: workflow.name
      })
    );
  }

  reviewApproval(tenantRef: string, approvalId: string, actorRef: string, decision: "reviewed" | "approved" | "rejected", note: string): GovernanceApprovalRecord {
    const approval = this.store.listApprovals(tenantRef).find((entry) => entry.approval_id === approvalId);
    if (!approval) {
      throw new Error(`approval_not_found:${approvalId}`);
    }
    return this.store.saveApproval(
      GovernanceApprovalRecordSchema.parse({
        ...approval,
        status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "in_review",
        decisions: [...approval.decisions, { actor_ref: actorRef, decision, note, timestamp: now() }]
      })
    );
  }

  saveRole(record: GovernanceRoleDefinition): GovernanceRoleDefinition {
    return this.store.saveRole(record);
  }

  saveAssignment(record: GovernanceRoleAssignment): GovernanceRoleAssignment {
    return this.store.saveAssignment(record);
  }

  savePolicy(record: GovernancePolicyRule): GovernancePolicyRule {
    return this.store.savePolicy(record);
  }

  saveKpi(record: GovernanceKpiDefinition): GovernanceKpiDefinition {
    return this.store.saveKpi(record);
  }

  previewKpiImpact(tenantRef: string, kpiId: string, candidate: Partial<GovernanceKpiDefinition>): JsonRecord {
    const current = this.store.listKpis(tenantRef).find((entry) => entry.kpi_id === kpiId);
    if (!current) {
      throw new Error(`kpi_not_found:${kpiId}`);
    }
    const merged = { ...current, ...candidate };
    return {
      kpi_id: current.kpi_id,
      current_formula: current.formula,
      candidate_formula: merged.formula,
      changed_fields: diffObjects(current, merged),
      affected_downstream_assets: this.store.listLibraryRecords(tenantRef).filter((entry) => entry.dependency_refs.includes(kpiId)).map((entry) => entry.asset_id)
    };
  }

  listRegistryEntries(): GovernanceRegistryEntry[] {
    return this.registryEntries();
  }

  createEvidence(tenantRef: string, actionId: string, resourceRef: string, context: JsonRecord, summary: JsonRecord): GovernanceEvidenceRecord {
    const record = this.store.saveEvidenceRecord(
      GovernanceEvidenceRecordSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        evidence_id: id("evidence", tenantRef, actionId, Date.now()),
        tenant_ref: tenantRef,
        action_id: actionId,
        resource_ref: resourceRef,
        status: "open",
        created_at: now(),
        closed_at: null,
        context,
        summary,
        attachments: [],
        closure: null
      })
    );
    this.evidenceCache.set(`${tenantRef}:${record.evidence_id}`, record);
    return record;
  }

  attachEvidence(tenantRef: string, evidenceId: string, attachment: { kind: string; ref: string; summary?: JsonRecord }): GovernanceEvidenceRecord {
    const current =
      this.store.listEvidenceRecords(tenantRef).find((entry) => entry.evidence_id === evidenceId) ??
      this.evidenceCache.get(`${tenantRef}:${evidenceId}`) ??
      null;
    if (!current) throw new Error(`evidence_not_found:${evidenceId}`);
    if (current.status === "closed") throw new Error(`evidence_immutable:${evidenceId}`);
    const next = GovernanceEvidenceRecordSchema.parse({
      ...current,
      attachments: [
        ...current.attachments,
        GovernanceEvidenceAttachmentSchema.parse({
          attachment_id: id("attachment", evidenceId, current.attachments.length + 1),
          attached_at: now(),
          kind: attachment.kind,
          ref: attachment.ref,
          summary: attachment.summary ?? {}
        })
      ]
    });
    const saved = this.store.saveEvidenceRecord(next);
    this.evidenceCache.set(`${tenantRef}:${evidenceId}`, saved);
    return saved;
  }

  closeEvidence(tenantRef: string, evidenceId: string, closure: JsonRecord): GovernanceEvidenceRecord {
    const current =
      this.store.listEvidenceRecords(tenantRef).find((entry) => entry.evidence_id === evidenceId) ??
      this.evidenceCache.get(`${tenantRef}:${evidenceId}`) ??
      null;
    if (!current) throw new Error(`evidence_not_found:${evidenceId}`);
    if (current.status === "closed") throw new Error(`evidence_immutable:${evidenceId}`);
    const saved = this.store.saveEvidenceRecord(
      GovernanceEvidenceRecordSchema.parse({
        ...current,
        status: "closed",
        closed_at: now(),
        closure
      })
    );
    this.evidenceCache.set(`${tenantRef}:${evidenceId}`, saved);
    return saved;
  }

  listPromptScans(tenantRef: string): GovernancePromptScan[] {
    return this.store.listPromptScans(tenantRef);
  }

  listComplianceChecks(tenantRef: string): GovernanceComplianceRecord[] {
    return this.store.listComplianceChecks(tenantRef);
  }

  scanPromptSurface(tenantRef: string, actorRef: string, actionId: string, prompt: string, context?: string): GovernancePromptScan {
    return this.scanPrompt(tenantRef, actionId, actorRef, { text: prompt, context });
  }

  complianceSurface(tenantRef: string, actorRef: string, actionId: string, resourceKind: GovernanceResourceKind, resourceRef: string, values: unknown, regulations?: string[]): GovernanceComplianceRecord {
    return this.runCompliance(
      tenantRef,
      {
        action_id: actionId,
        actor: { actor_ref: actorRef, tenant_ref: tenantRef, workspace_id: "workspace-governance", page_path: "/governance" },
        resource_kind: resourceKind,
        resource_ref: resourceRef,
        input_payload: {},
        preflight: undefined,
        delegate: () => ({ result: null as never })
      },
      { values, regulations }
    );
  }

  libraryMatrix(tenantRef: string): JsonRecord {
    const records = this.store.listLibraryRecords(tenantRef);
    const dependents = records.flatMap((record) => record.dependency_refs.map((dependency) => ({ dependency, asset_id: record.asset_id })));
    const blocked_assets = records
      .filter((record) => record.downstream_refs.length > 0 && record.approval_required !== true)
      .map((record) => ({
        asset_id: record.asset_id,
        reason: "downstream_break_policy_required",
        downstream_refs: record.downstream_refs
      }));
    return {
      assets: records,
      dependency_edges: dependents,
      blocked_assets,
      notifications: records.flatMap((record) => record.notifications.map((notification) => ({ asset_id: record.asset_id, notification })))
    };
  }

  saveLibraryRecord(record: GovernanceLibraryRecord): GovernanceLibraryRecord {
    const current = this.store.listLibraryRecords(record.tenant_ref).find((entry) => entry.asset_id === record.asset_id);
    const dependents = this.store.listLibraryRecords(record.tenant_ref).filter((entry) => entry.dependency_refs.includes(record.asset_id)).map((entry) => entry.asset_id);
    if (current && current.version_id !== record.version_id && dependents.length > 0 && record.approval_required !== true) {
      throw new Error(`downstream_break_policy_required:${record.asset_id}`);
    }
    const next = GovernanceLibraryRecordSchema.parse({
      ...record,
      downstream_refs: [...new Set([...(record.downstream_refs ?? []), ...dependents])],
      notifications: [...new Set([...(record.notifications ?? []), ...dependents.map((dependent) => `notify:${dependent}`)])]
    });
    const saved = this.store.saveLibraryRecord(next);
    for (const dependencyRef of saved.dependency_refs) {
      const dependency = this.store.listLibraryRecords(record.tenant_ref).find((entry) => entry.asset_id === dependencyRef);
      if (dependency) {
        this.store.saveLibraryRecord(
          GovernanceLibraryRecordSchema.parse({
            ...dependency,
            downstream_refs: [...new Set([...dependency.downstream_refs, saved.asset_id])],
            notifications: [...new Set([...dependency.notifications, `notify:${saved.asset_id}`])]
          })
        );
      }
    }
    return saved;
  }

  saveLibraryAssetMirror(tenantRef: string, asset: LibraryAsset): GovernanceLibraryRecord {
    const parsed = LibraryAssetSchema.parse(asset);
    return this.saveLibraryRecord(
      GovernanceLibraryRecordSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        asset_id: parsed.asset_id,
        tenant_ref: tenantRef,
        library_kind: parsed.library_kind === "shared" ? "shared" : "tenant",
        owner_ref: parsed.owner_ref ?? "unknown",
        asset_type: parsed.asset_type,
        version_id: parsed.version,
        dependency_refs: parsed.dependency_refs,
        downstream_refs: parsed.downstream_dependency_refs,
        approval_required: parsed.approval_state !== "approved",
        notifications: parsed.notification_refs,
        branding_policy_ref: null,
        theme_policy_ref: null
      })
    );
  }

  listSnapshot(tenantRef: string): GovernanceTenantSnapshot {
    return this.store.ensureTenant(tenantRef);
  }

  async executeAction<T>(input: GovernanceExecutionInput<T>): Promise<GovernanceExecutionResult<T>> {
    this.store.ensureTenant(input.actor.tenant_ref);
    const queueControl = this.reserveQueue(input);
    let activeEvidence = this.createEvidence(
      input.actor.tenant_ref,
      input.action_id,
      input.resource_ref,
      {
        actor_ref: input.actor.actor_ref,
        page_path: input.actor.page_path,
        workspace_id: input.actor.workspace_id,
        source_refs: input.source_refs ?? []
      },
      { input_summary: summarizeValue(input.input_payload), priority_class: input.priority_class ?? "P2" }
    );
    const persistActiveEvidence = (record: GovernanceEvidenceRecord): GovernanceEvidenceRecord => {
      const saved = this.store.saveEvidenceRecord(record);
      this.evidenceCache.set(`${input.actor.tenant_ref}:${saved.evidence_id}`, saved);
      activeEvidence = saved;
      return saved;
    };
    const ensureEvidenceAttachment = (attachment: { kind: string; ref: string; summary?: JsonRecord }): void => {
      persistActiveEvidence(
        GovernanceEvidenceRecordSchema.parse({
          ...activeEvidence,
          attachments: [
            ...activeEvidence.attachments,
            GovernanceEvidenceAttachmentSchema.parse({
              attachment_id: id("attachment", activeEvidence.evidence_id, activeEvidence.attachments.length + 1),
              attached_at: now(),
              kind: attachment.kind,
              ref: attachment.ref,
              summary: attachment.summary ?? {}
            })
          ]
        })
      );
    };
    const ensureEvidenceClosed = (closure: JsonRecord): void => {
      if (activeEvidence.status === "closed") {
        return;
      }
      persistActiveEvidence(
        GovernanceEvidenceRecordSchema.parse({
          ...activeEvidence,
          status: "closed",
          closed_at: now(),
          closure
        })
      );
    };
    const decision = this.authorize(input);
    const buildAudit = (status: "executed" | "denied" | "approval_required", outputSummary: JsonRecord, degradeReason: string | null): AuditEvent =>
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", input.actor.tenant_ref, input.action_id, Date.now()),
        timestamp: now(),
        actor_ref: input.actor.actor_ref,
        actor_type: input.action_id.includes(".ai.") ? "ai" : "user",
        action_ref: input.action_id,
        job_ref: id("job", "governance", input.action_id, Date.now()),
        object_refs: [input.resource_ref],
        target_ref: input.resource_ref,
        target_kind: input.resource_kind,
        workspace_id: input.actor.workspace_id,
        tenant_ref: input.actor.tenant_ref,
        result_status: status === "executed" ? "success" : status === "approval_required" ? "success_with_warnings" : "failed",
        permission_decision_ref: decision.decision_id,
        input_summary: summarizeValue(input.input_payload) as JsonRecord,
        output_summary: summarizeValue(outputSummary) as JsonRecord,
        degrade_reason: degradeReason,
        metadata: {
          actor: input.actor.actor_ref,
          tenant: input.actor.tenant_ref,
          target: input.resource_ref,
          action: input.action_id,
          permission_decision: decision.decision,
          inputs_summary: summarizeValue(input.input_payload),
          outputs_summary: summarizeValue(outputSummary),
          result_status: status,
          priority_class: queueControl.priority_class,
          pressure_state: queueControl.pressure_state,
          page_path: input.actor.page_path
        }
      });

    try {
      if (decision.decision === "denied") {
        const audit = this.store.appendAuditEvent(input.actor.tenant_ref, buildAudit("denied", { denied: true }, decision.reasons.join("; ")));
        ensureEvidenceAttachment({ kind: "audit", ref: audit.event_id, summary: { status: "denied", reasons: decision.reasons } });
        ensureEvidenceClosed({ status: "denied", decision_id: decision.decision_id });
        return { status: "denied", decision, audit_event: audit, lineage_edges: [], approval: null, version_record: null, diff_artifact: null, replay_bundle: null, queue_control: queueControl, result: null };
      }
      if (decision.decision === "approval_required" && input.approval_granted !== true) {
        const approval = this.createApproval(input);
        const audit = this.store.appendAuditEvent(input.actor.tenant_ref, buildAudit("approval_required", { approval_id: approval.approval_id }, "approval_required"));
        ensureEvidenceAttachment({ kind: "approval", ref: approval.approval_id, summary: { status: "pending" } });
        ensureEvidenceAttachment({ kind: "audit", ref: audit.event_id, summary: { status: "approval_required" } });
        ensureEvidenceClosed({ status: "approval_required", approval_id: approval.approval_id });
        return { status: "approval_required", decision, audit_event: audit, lineage_edges: [], approval, version_record: null, diff_artifact: null, replay_bundle: null, queue_control: queueControl, result: null };
      }

      const executionEnvelope = GovernanceExecutionEnvelopeSchema.parse({
        contract: GOVERNANCE_CONTRACT,
        schema_namespace: "rasid.shared.governance.v1",
        schema_version: "1.0.0",
        execution_id: id("execution", input.actor.tenant_ref, input.action_id, Date.now()),
        tenant_ref: input.actor.tenant_ref,
        workspace_id: input.actor.workspace_id,
        actor_ref: input.actor.actor_ref,
        page_path: input.actor.page_path,
        action_id: input.action_id,
        resource_kind: input.resource_kind,
        resource_ref: input.resource_ref,
        requested_mode: input.actor.requested_mode ?? "advanced",
        approval_policy: this.actionDefinition(input.action_id)?.approval_policy ?? "conditional",
        priority_class: input.priority_class ?? "P2",
        source_refs: input.source_refs ?? [],
        target_refs: input.target_refs ?? [],
        started_at: now(),
        finished_at: null
      });
      const resultPayload = await input.delegate();
      const targetRefs = resultPayload.target_refs ?? input.target_refs ?? [input.resource_ref];
      const lineageEdges = this.store.appendLineageEdges(
        input.actor.tenant_ref,
        (input.source_refs ?? [input.resource_ref]).flatMap((sourceRef) =>
          targetRefs.map((targetRef) =>
            LineageEdgeSchema.parse({
              edge_id: id("lineage", input.actor.tenant_ref, input.action_id, sourceRef, targetRef, Date.now()),
              from_ref: sourceRef,
              to_ref: targetRef,
              tenant_ref: input.actor.tenant_ref,
              action_ref: input.action_id,
              transform_ref: input.action_id,
              ai_suggestion_ref: "",
              ai_decision: input.action_id.includes(".ai.") ? "accepted" : "not_applicable",
              template_ref: "",
              dataset_binding_ref: "",
              version_diff_ref: "",
              evidence_ref: activeEvidence.evidence_id,
              approval_ref: ""
            })
          )
        )
      );

      const versionRecord = resultPayload.version_ref
        ? this.store.saveVersion(
            GovernanceVersionRecordSchema.parse({
              contract: GOVERNANCE_CONTRACT,
              schema_namespace: "rasid.shared.governance.v1",
              schema_version: "1.0.0",
              version_record_id: id("version-record", input.actor.tenant_ref, input.resource_ref, Date.now()),
              tenant_ref: input.actor.tenant_ref,
              resource_kind: input.resource_kind,
              resource_ref: input.resource_ref,
              version_ref: resultPayload.version_ref,
              previous_version_id: resultPayload.previous_version_id ?? resultPayload.version_ref.parent_version_id,
              change_summary: input.action_id,
              downstream_refs: this.store.listLibraryRecords(input.actor.tenant_ref).filter((entry) => entry.dependency_refs.includes(input.resource_ref)).map((entry) => entry.asset_id),
              protected_downstream: this.store.listLibraryRecords(input.actor.tenant_ref).some((entry) => entry.downstream_refs.includes(input.resource_ref)),
              created_at: now()
            })
          )
        : null;

      const diffArtifact = resultPayload.diff_source
        ? this.store.saveDiff(
            GovernanceDiffArtifactSchema.parse({
              contract: GOVERNANCE_CONTRACT,
              schema_namespace: "rasid.shared.governance.v1",
              schema_version: "1.0.0",
              diff_id: id("diff", input.actor.tenant_ref, input.action_id, Date.now()),
              tenant_ref: input.actor.tenant_ref,
              resource_kind: input.resource_kind,
              left_ref: resultPayload.diff_source.left_ref,
              right_ref: resultPayload.diff_source.right_ref,
              summary: resultPayload.diff_source.summary ?? `${input.action_id} diff`,
              changed_fields: diffObjects(resultPayload.diff_source.left, resultPayload.diff_source.right),
              generated_at: now()
            })
          )
        : null;

      if (resultPayload.kpi_record) this.store.saveKpi(resultPayload.kpi_record);
      if (resultPayload.library_record) this.store.saveLibraryRecord(resultPayload.library_record);

      const replay = this.store.saveReplay(
        GovernanceReplayBundleSchema.parse({
          contract: GOVERNANCE_CONTRACT,
          schema_namespace: "rasid.shared.governance.v1",
          schema_version: "1.0.0",
          replay_id: id("replay", input.actor.tenant_ref, input.action_id, Date.now()),
          tenant_ref: input.actor.tenant_ref,
          action_id: input.action_id,
          execution_id: executionEnvelope.execution_id,
          input_hash: hash(JSON.stringify(input.input_payload)),
          output_refs: targetRefs,
          evidence_refs: lineageEdges.map((entry) => entry.evidence_ref ?? "").filter(Boolean),
          artifact_refs: [input.resource_ref, ...targetRefs],
          bundle_ref: `governance://${input.actor.tenant_ref}/${executionEnvelope.execution_id}`,
          generated_at: now()
        })
      );

      this.store.appendWorkflowTemplate(input.actor.tenant_ref, {
        template_id: id("workflow-template", input.action_id),
        action_id: input.action_id,
        resource_kind: input.resource_kind,
        last_input_summary: summarizeValue(input.input_payload),
        last_output_summary: summarizeValue(resultPayload.output_summary ?? {}),
        replay_id: replay.replay_id
      });

      const audit = this.store.appendAuditEvent(input.actor.tenant_ref, buildAudit("executed", resultPayload.output_summary ?? { target_refs: targetRefs }, null));
      ensureEvidenceAttachment({
        kind: "audit",
        ref: audit.event_id,
        summary: { status: "executed", decision: decision.decision }
      });
      ensureEvidenceAttachment({
        kind: "targets",
        ref: targetRefs.join(","),
        summary: { target_refs: targetRefs }
      });
      ensureEvidenceClosed({
        status: "executed",
        audit_id: audit.event_id,
        replay_id: replay.replay_id,
        target_refs: targetRefs
      });
      return { status: "executed", decision, audit_event: audit, lineage_edges: lineageEdges, approval: null, version_record: versionRecord, diff_artifact: diffArtifact, replay_bundle: replay, queue_control: queueControl, result: resultPayload.result };
    } finally {
      this.releaseQueue(input);
    }
  }
}

export const registerGovernanceCapability = (runtime: RegistryBootstrap): void => {
  runtime.registerCapability({
    capability_id: GOVERNANCE_CAPABILITY_ID,
    display_name: "Governance Engine",
    package_name: "@rasid/governance-engine",
    contract_version: "1.0.0",
    supported_action_refs: GovernanceActionRegistry.map((entry) => entry.action_id),
    supported_tool_refs: []
  });
  runtime.registerManifest(createActionManifest(GOVERNANCE_CAPABILITY_ID, "1.0.0", GovernanceActionRegistry, ["approval.default"], ["evidence.default"]));
};
