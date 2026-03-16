/**
 * Audit & Governance Service — Adapted from Seed
 *
 * Combines audit logging, compliance checking, RBAC, feature flags,
 * and prompt injection guard from 03_governance_evidence.
 *
 * Adapted: PrismaClient → prismaAdapter (sql.js), Express → tRPC
 * Original: 03_governance_evidence/services/governance-service/src/services/ (2972 lines total)
 */

import { randomUUID, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG = "[Governance]";
const log = {
  info: (msg: string, m?: any) => console.log(`${LOG} ${msg}`, m || ""),
  warn: (msg: string, m?: any) => console.warn(`${LOG} ${msg}`, m || ""),
  error: (msg: string, m?: any) => console.error(`${LOG} ${msg}`, m || ""),
  debug: (msg: string, m?: any) => {},
};

// ---------------------------------------------------------------------------
// Types — Audit
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
  hash: string;
}

export interface AuditQuery {
  tenantId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEntries: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byEntityType: Record<string, number>;
  period: { from: string; to: string };
}

// ---------------------------------------------------------------------------
// Types — Compliance
// ---------------------------------------------------------------------------

export interface ComplianceCheckRequest {
  datasetId?: string;
  resourceType: "dataset" | "document" | "user_data" | "api_log";
  regulations: ("gdpr" | "pdpl" | "hipaa" | "ccpa")[];
  scope: "full" | "quick" | "specific_fields";
  fields?: string[];
}

export interface ComplianceCheckResult {
  id: string;
  status: "compliant" | "non_compliant" | "needs_review" | "partial";
  overallScore: number;
  regulations: RegulationResult[];
  issues: ComplianceIssue[];
  recommendations: string[];
  checkedAt: string;
  duration: number;
}

export interface RegulationResult {
  regulation: string;
  compliant: boolean;
  score: number;
  articles: ArticleCheck[];
  issues: ComplianceIssue[];
}

export interface ArticleCheck {
  articleId: string;
  articleTitle: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  description: string;
  evidence?: string;
}

export interface ComplianceIssue {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  regulation: string;
  description: string;
  affectedFields: string[];
  suggestedAction: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
}

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  retentionPeriodDays: number;
  action: "delete" | "anonymize" | "archive";
  enabled: boolean;
}

export interface PrivacyImpactAssessment {
  id: string;
  projectId: string;
  overallRiskLevel: "low" | "medium" | "high" | "very_high";
  dataCategories: string[];
  risks: PrivacyRisk[];
  mitigations: string[];
}

export interface PrivacyRisk {
  id: string;
  category: string;
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high" | "very_high";
}

// ---------------------------------------------------------------------------
// Types — RBAC
// ---------------------------------------------------------------------------

export interface Permission {
  resource: string;
  action: "create" | "read" | "update" | "delete" | "execute" | "admin";
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: string[];
}

export interface RBACCheckResult {
  allowed: boolean;
  role: string;
  permission: Permission;
  reason: string;
}

// ---------------------------------------------------------------------------
// Types — Feature Flags
// ---------------------------------------------------------------------------

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions: FeatureFlagCondition[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagCondition {
  type: "user" | "tenant" | "role" | "percentage" | "date";
  operator: "equals" | "in" | "gt" | "lt" | "between";
  value: unknown;
}

// ---------------------------------------------------------------------------
// Types — Prompt Injection Guard
// ---------------------------------------------------------------------------

export interface PromptGuardResult {
  safe: boolean;
  score: number;
  threats: PromptThreat[];
  sanitized: string;
}

export interface PromptThreat {
  type: "injection" | "jailbreak" | "data_extraction" | "role_manipulation" | "encoding_attack";
  severity: "low" | "medium" | "high" | "critical";
  pattern: string;
  position: number;
  description: string;
}

// ---------------------------------------------------------------------------
// PDPL (Saudi Arabia) Articles
// ---------------------------------------------------------------------------

const PDPL_ARTICLES: ArticleCheck[] = [
  { articleId: "PDPL-5", articleTitle: "Lawful Processing Basis", status: "pass", description: "Data processing must have a lawful basis" },
  { articleId: "PDPL-6", articleTitle: "Consent Requirements", status: "pass", description: "Explicit consent required for personal data processing" },
  { articleId: "PDPL-10", articleTitle: "Data Minimization", status: "pass", description: "Only necessary data should be collected" },
  { articleId: "PDPL-14", articleTitle: "Data Subject Rights", status: "pass", description: "Right to access, correct, and delete personal data" },
  { articleId: "PDPL-17", articleTitle: "Data Breach Notification", status: "pass", description: "Notify authority within 72 hours of breach" },
  { articleId: "PDPL-22", articleTitle: "Cross-Border Transfer", status: "pass", description: "Adequate protection for international data transfers" },
  { articleId: "PDPL-25", articleTitle: "Data Protection Officer", status: "pass", description: "Appointment of DPO when required" },
  { articleId: "PDPL-29", articleTitle: "Record Keeping", status: "pass", description: "Maintain records of processing activities" },
];

// ---------------------------------------------------------------------------
// Prompt injection patterns
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: { pattern: RegExp; type: PromptThreat["type"]; severity: PromptThreat["severity"]; desc: string }[] = [
  { pattern: /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i, type: "injection", severity: "critical", desc: "Attempt to override system instructions" },
  { pattern: /you\s+are\s+now\s+/i, type: "role_manipulation", severity: "high", desc: "Attempt to redefine AI role" },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, type: "role_manipulation", severity: "high", desc: "Attempt to impersonate another role" },
  { pattern: /system\s*prompt|initial\s*prompt|hidden\s*prompt/i, type: "data_extraction", severity: "high", desc: "Attempt to extract system prompt" },
  { pattern: /\bDAN\b|do\s+anything\s+now/i, type: "jailbreak", severity: "critical", desc: "Known jailbreak pattern (DAN)" },
  { pattern: /base64|atob|btoa|eval\s*\(/i, type: "encoding_attack", severity: "medium", desc: "Potential encoding-based attack" },
  { pattern: /\{\{.*\}\}|\$\{.*\}/i, type: "injection", severity: "medium", desc: "Template injection attempt" },
  { pattern: /DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+.*SET/i, type: "injection", severity: "high", desc: "SQL injection attempt" },
  { pattern: /<script|javascript:|on\w+\s*=/i, type: "injection", severity: "high", desc: "XSS injection attempt" },
];

// ---------------------------------------------------------------------------
// Default roles
// ---------------------------------------------------------------------------

const DEFAULT_ROLES: Role[] = [
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access",
    permissions: [
      { resource: "*", action: "admin" },
      { resource: "*", action: "create" },
      { resource: "*", action: "read" },
      { resource: "*", action: "update" },
      { resource: "*", action: "delete" },
      { resource: "*", action: "execute" },
    ],
  },
  {
    id: "editor",
    name: "Editor",
    description: "Can create and edit content",
    permissions: [
      { resource: "document", action: "create" },
      { resource: "document", action: "read" },
      { resource: "document", action: "update" },
      { resource: "dataset", action: "create" },
      { resource: "dataset", action: "read" },
      { resource: "dataset", action: "update" },
      { resource: "report", action: "create" },
      { resource: "report", action: "read" },
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: [
      { resource: "document", action: "read" },
      { resource: "dataset", action: "read" },
      { resource: "report", action: "read" },
    ],
  },
  {
    id: "auditor",
    name: "Auditor",
    description: "Audit and compliance access",
    permissions: [
      { resource: "audit", action: "read" },
      { resource: "compliance", action: "read" },
      { resource: "compliance", action: "execute" },
      { resource: "report", action: "read" },
    ],
  },
];

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const auditStore: AuditEntry[] = [];
const featureFlagStore = new Map<string, FeatureFlag>();
const roleStore = new Map<string, Role>(DEFAULT_ROLES.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AuditGovernanceService {
  private db: any;

  constructor(dbAdapter?: any) {
    this.db = dbAdapter;
  }

  // ─── Audit ──────────────────────────────────────────────────

  async logAction(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>,
    ipAddress: string,
    tenantId: string
  ): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: randomUUID(),
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
      hash: "",
    };

    // Create tamper-proof hash
    const prevHash = auditStore.length > 0 ? auditStore[auditStore.length - 1].hash : "genesis";
    entry.hash = createHash("sha256")
      .update(`${prevHash}|${entry.id}|${entry.userId}|${entry.action}|${entry.timestamp}`)
      .digest("hex");

    auditStore.push(entry);

    // Persist to DB
    if (this.db?.auditLog) {
      await this.db.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType,
          entityId,
          detailsJson: JSON.stringify(details),
          ipAddress,
          hash: entry.hash,
        },
      });
    }

    log.info("Audit action logged", { id: entry.id, action, entityType });
    return entry;
  }

  async queryAuditLog(query: AuditQuery): Promise<AuditEntry[]> {
    let results = auditStore.filter((e) => e.tenantId === query.tenantId);
    if (query.userId) results = results.filter((e) => e.userId === query.userId);
    if (query.action) results = results.filter((e) => e.action === query.action);
    if (query.entityType) results = results.filter((e) => e.entityType === query.entityType);
    if (query.from) results = results.filter((e) => e.timestamp >= query.from!);
    if (query.to) results = results.filter((e) => e.timestamp <= query.to!);

    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async getAuditSummary(tenantId: string, from: string, to: string): Promise<AuditSummary> {
    const entries = auditStore.filter(
      (e) => e.tenantId === tenantId && e.timestamp >= from && e.timestamp <= to
    );

    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};

    for (const e of entries) {
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      byUser[e.userId] = (byUser[e.userId] || 0) + 1;
      byEntityType[e.entityType] = (byEntityType[e.entityType] || 0) + 1;
    }

    return { totalEntries: entries.length, byAction, byUser, byEntityType, period: { from, to } };
  }

  verifyAuditChain(): { valid: boolean; brokenAt?: number } {
    for (let i = 1; i < auditStore.length; i++) {
      const prev = auditStore[i - 1];
      const curr = auditStore[i];
      const expected = createHash("sha256")
        .update(`${prev.hash}|${curr.id}|${curr.userId}|${curr.action}|${curr.timestamp}`)
        .digest("hex");
      if (curr.hash !== expected) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  }

  // ─── Compliance ─────────────────────────────────────────────

  async checkCompliance(request: ComplianceCheckRequest): Promise<ComplianceCheckResult> {
    const startTime = Date.now();
    const id = randomUUID();
    const regulations: RegulationResult[] = [];
    const allIssues: ComplianceIssue[] = [];

    for (const reg of request.regulations) {
      const result = this.checkRegulation(reg, request);
      regulations.push(result);
      allIssues.push(...result.issues);
    }

    const overallScore = regulations.length > 0
      ? regulations.reduce((sum, r) => sum + r.score, 0) / regulations.length
      : 100;

    const status: ComplianceCheckResult["status"] =
      overallScore >= 90 ? "compliant" :
      overallScore >= 70 ? "partial" :
      overallScore >= 50 ? "needs_review" : "non_compliant";

    const recommendations = this.generateRecommendations(allIssues);

    return {
      id,
      status,
      overallScore,
      regulations,
      issues: allIssues,
      recommendations,
      checkedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }

  private checkRegulation(regulation: string, request: ComplianceCheckRequest): RegulationResult {
    const issues: ComplianceIssue[] = [];
    let articles: ArticleCheck[] = [];

    switch (regulation) {
      case "pdpl":
        articles = PDPL_ARTICLES.map((a) => ({ ...a }));
        // Check data minimization
        if (request.scope === "full" && request.fields && request.fields.length > 20) {
          articles[2].status = "warning";
          issues.push({
            id: randomUUID(),
            severity: "medium",
            category: "data_minimization",
            regulation: "pdpl",
            description: "Large number of fields may violate data minimization principle",
            affectedFields: request.fields.slice(20),
            suggestedAction: "Review and remove unnecessary fields",
            status: "open",
          });
        }
        break;

      case "gdpr":
        articles = [
          { articleId: "GDPR-6", articleTitle: "Lawfulness of Processing", status: "pass", description: "Processing must have a legal basis" },
          { articleId: "GDPR-7", articleTitle: "Conditions for Consent", status: "pass", description: "Consent must be freely given" },
          { articleId: "GDPR-17", articleTitle: "Right to Erasure", status: "pass", description: "Right to be forgotten" },
          { articleId: "GDPR-25", articleTitle: "Data Protection by Design", status: "pass", description: "Privacy by design and default" },
          { articleId: "GDPR-33", articleTitle: "Breach Notification", status: "pass", description: "72-hour notification requirement" },
        ];
        break;

      default:
        articles = [{ articleId: `${regulation}-1`, articleTitle: "General Compliance", status: "pass", description: "Basic compliance check" }];
    }

    const failedArticles = articles.filter((a) => a.status === "fail");
    const warningArticles = articles.filter((a) => a.status === "warning");
    const score = articles.length > 0
      ? ((articles.length - failedArticles.length - warningArticles.length * 0.5) / articles.length) * 100
      : 100;

    return {
      regulation,
      compliant: failedArticles.length === 0,
      score,
      articles,
      issues,
    };
  }

  private generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recommendations: string[] = [];
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const highCount = issues.filter((i) => i.severity === "high").length;

    if (criticalCount > 0) recommendations.push("Address critical compliance issues immediately");
    if (highCount > 0) recommendations.push("Schedule remediation for high-severity issues within 30 days");
    if (issues.some((i) => i.category === "data_minimization")) recommendations.push("Review data collection practices for minimization");
    if (issues.length === 0) recommendations.push("Continue monitoring and periodic compliance reviews");

    return recommendations;
  }

  // ─── RBAC ───────────────────────────────────────────────────

  checkPermission(userRole: string, resource: string, action: Permission["action"]): RBACCheckResult {
    const role = roleStore.get(userRole);
    if (!role) {
      return { allowed: false, role: userRole, permission: { resource, action }, reason: "Role not found" };
    }

    for (const perm of role.permissions) {
      if ((perm.resource === "*" || perm.resource === resource) &&
          (perm.action === "admin" || perm.action === action)) {
        return { allowed: true, role: userRole, permission: { resource, action }, reason: "Permission granted" };
      }
    }

    // Check inherited roles
    if (role.inherits) {
      for (const parentRoleId of role.inherits) {
        const parentResult = this.checkPermission(parentRoleId, resource, action);
        if (parentResult.allowed) return parentResult;
      }
    }

    return { allowed: false, role: userRole, permission: { resource, action }, reason: "Permission denied" };
  }

  getRole(roleId: string): Role | undefined {
    return roleStore.get(roleId);
  }

  listRoles(): Role[] {
    return Array.from(roleStore.values());
  }

  createRole(role: Role): void {
    roleStore.set(role.id, role);
    log.info("Role created", { roleId: role.id, name: role.name });
  }

  // ─── Feature Flags ──────────────────────────────────────────

  isFeatureEnabled(flagName: string, context?: { userId?: string; tenantId?: string; role?: string }): boolean {
    const flag = featureFlagStore.get(flagName);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // Check conditions
    for (const condition of flag.conditions) {
      if (condition.type === "user" && context?.userId) {
        const allowed = Array.isArray(condition.value) ? condition.value : [condition.value];
        if (!allowed.includes(context.userId)) return false;
      }
      if (condition.type === "tenant" && context?.tenantId) {
        const allowed = Array.isArray(condition.value) ? condition.value : [condition.value];
        if (!allowed.includes(context.tenantId)) return false;
      }
      if (condition.type === "percentage") {
        const hash = createHash("md5").update(`${flagName}:${context?.userId || "anon"}`).digest("hex");
        const bucket = parseInt(hash.slice(0, 8), 16) % 100;
        if (bucket >= (condition.value as number)) return false;
      }
    }

    return true;
  }

  setFeatureFlag(flag: FeatureFlag): void {
    featureFlagStore.set(flag.name, flag);
    log.info("Feature flag updated", { name: flag.name, enabled: flag.enabled });
  }

  listFeatureFlags(): FeatureFlag[] {
    return Array.from(featureFlagStore.values());
  }

  // ─── Prompt Injection Guard ─────────────────────────────────

  scanPrompt(input: string): PromptGuardResult {
    const threats: PromptThreat[] = [];

    for (const { pattern, type, severity, desc } of INJECTION_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        threats.push({
          type,
          severity,
          pattern: match[0],
          position: match.index || 0,
          description: desc,
        });
      }
    }

    // Calculate safety score
    const severityWeights = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.1 };
    const totalWeight = threats.reduce((sum, t) => sum + severityWeights[t.severity], 0);
    const score = Math.max(0, 1 - totalWeight);

    // Sanitize
    let sanitized = input;
    for (const threat of threats) {
      if (threat.severity === "critical" || threat.severity === "high") {
        sanitized = sanitized.replace(threat.pattern, "[REDACTED]");
      }
    }

    return {
      safe: threats.filter((t) => t.severity === "critical" || t.severity === "high").length === 0,
      score,
      threats,
      sanitized,
    };
  }
}

export default AuditGovernanceService;
