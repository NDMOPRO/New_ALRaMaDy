// GP-0293→GP-0404: 100+ granular permissions in perm.domain.resource.action format

export interface PermissionDef {
  code: string;
  domain: string;
  resource: string;
  action: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDef[] = [
  // ── Data & Files (perm.data.*) ──
  { code: 'perm.data.file.create', domain: 'data', resource: 'file', action: 'create', description: 'Upload files' },
  { code: 'perm.data.file.read', domain: 'data', resource: 'file', action: 'read', description: 'Read files' },
  { code: 'perm.data.file.update', domain: 'data', resource: 'file', action: 'update', description: 'Update files' },
  { code: 'perm.data.file.delete', domain: 'data', resource: 'file', action: 'delete', description: 'Delete files' },
  { code: 'perm.data.file.export', domain: 'data', resource: 'file', action: 'export', description: 'Export files' },
  { code: 'perm.data.file.share', domain: 'data', resource: 'file', action: 'share', description: 'Share files' },
  { code: 'perm.data.dataset.create', domain: 'data', resource: 'dataset', action: 'create', description: 'Create datasets' },
  { code: 'perm.data.dataset.read', domain: 'data', resource: 'dataset', action: 'read', description: 'Read datasets' },
  { code: 'perm.data.dataset.update', domain: 'data', resource: 'dataset', action: 'update', description: 'Update datasets' },
  { code: 'perm.data.dataset.delete', domain: 'data', resource: 'dataset', action: 'delete', description: 'Delete datasets' },
  { code: 'perm.data.dataset.classify', domain: 'data', resource: 'dataset', action: 'classify', description: 'Classify data sensitivity' },
  { code: 'perm.data.dataset.mask', domain: 'data', resource: 'dataset', action: 'mask', description: 'Mask sensitive data' },
  { code: 'perm.data.dataset.anonymize', domain: 'data', resource: 'dataset', action: 'anonymize', description: 'Anonymize data' },
  { code: 'perm.data.connector.create', domain: 'data', resource: 'connector', action: 'create', description: 'Create data connectors' },
  { code: 'perm.data.connector.manage', domain: 'data', resource: 'connector', action: 'manage', description: 'Manage data connectors' },

  // ── Excel / SVM (perm.excel.*) ──
  { code: 'perm.excel.workbook.create', domain: 'excel', resource: 'workbook', action: 'create', description: 'Create workbooks' },
  { code: 'perm.excel.workbook.read', domain: 'excel', resource: 'workbook', action: 'read', description: 'Read workbooks' },
  { code: 'perm.excel.workbook.update', domain: 'excel', resource: 'workbook', action: 'update', description: 'Update workbooks' },
  { code: 'perm.excel.workbook.delete', domain: 'excel', resource: 'workbook', action: 'delete', description: 'Delete workbooks' },
  { code: 'perm.excel.workbook.export', domain: 'excel', resource: 'workbook', action: 'export', description: 'Export workbooks' },
  { code: 'perm.excel.formula.execute', domain: 'excel', resource: 'formula', action: 'execute', description: 'Execute formulas' },
  { code: 'perm.excel.pivot.manage', domain: 'excel', resource: 'pivot', action: 'manage', description: 'Manage pivot tables' },

  // ── Dashboard (perm.dashboard.*) ──
  { code: 'perm.dashboard.board.create', domain: 'dashboard', resource: 'board', action: 'create', description: 'Create dashboards' },
  { code: 'perm.dashboard.board.read', domain: 'dashboard', resource: 'board', action: 'read', description: 'View dashboards' },
  { code: 'perm.dashboard.board.update', domain: 'dashboard', resource: 'board', action: 'update', description: 'Edit dashboards' },
  { code: 'perm.dashboard.board.delete', domain: 'dashboard', resource: 'board', action: 'delete', description: 'Delete dashboards' },
  { code: 'perm.dashboard.board.publish', domain: 'dashboard', resource: 'board', action: 'publish', description: 'Publish dashboards' },
  { code: 'perm.dashboard.board.share', domain: 'dashboard', resource: 'board', action: 'share', description: 'Share dashboards' },
  { code: 'perm.dashboard.widget.manage', domain: 'dashboard', resource: 'widget', action: 'manage', description: 'Manage widgets' },
  { code: 'perm.dashboard.kpi.create', domain: 'dashboard', resource: 'kpi', action: 'create', description: 'Create KPIs' },
  { code: 'perm.dashboard.kpi.read', domain: 'dashboard', resource: 'kpi', action: 'read', description: 'View KPIs' },
  { code: 'perm.dashboard.kpi.update', domain: 'dashboard', resource: 'kpi', action: 'update', description: 'Edit KPIs' },
  { code: 'perm.dashboard.kpi.delete', domain: 'dashboard', resource: 'kpi', action: 'delete', description: 'Delete KPIs' },
  { code: 'perm.dashboard.kpi.approve', domain: 'dashboard', resource: 'kpi', action: 'approve', description: 'Approve KPI changes' },

  // ── Reports (perm.report.*) ──
  { code: 'perm.report.report.create', domain: 'report', resource: 'report', action: 'create', description: 'Create reports' },
  { code: 'perm.report.report.read', domain: 'report', resource: 'report', action: 'read', description: 'View reports' },
  { code: 'perm.report.report.update', domain: 'report', resource: 'report', action: 'update', description: 'Edit reports' },
  { code: 'perm.report.report.delete', domain: 'report', resource: 'report', action: 'delete', description: 'Delete reports' },
  { code: 'perm.report.report.export', domain: 'report', resource: 'report', action: 'export', description: 'Export reports' },
  { code: 'perm.report.report.publish', domain: 'report', resource: 'report', action: 'publish', description: 'Publish reports' },
  { code: 'perm.report.report.schedule', domain: 'report', resource: 'report', action: 'schedule', description: 'Schedule reports' },
  { code: 'perm.report.template.manage', domain: 'report', resource: 'template', action: 'manage', description: 'Manage report templates' },

  // ── Presentations (perm.presentation.*) ──
  { code: 'perm.presentation.slide.create', domain: 'presentation', resource: 'slide', action: 'create', description: 'Create presentations' },
  { code: 'perm.presentation.slide.read', domain: 'presentation', resource: 'slide', action: 'read', description: 'View presentations' },
  { code: 'perm.presentation.slide.update', domain: 'presentation', resource: 'slide', action: 'update', description: 'Edit presentations' },
  { code: 'perm.presentation.slide.delete', domain: 'presentation', resource: 'slide', action: 'delete', description: 'Delete presentations' },
  { code: 'perm.presentation.slide.export', domain: 'presentation', resource: 'slide', action: 'export', description: 'Export presentations' },
  { code: 'perm.presentation.infographic.create', domain: 'presentation', resource: 'infographic', action: 'create', description: 'Create infographics' },
  { code: 'perm.presentation.infographic.manage', domain: 'presentation', resource: 'infographic', action: 'manage', description: 'Manage infographics' },

  // ── Replication / STRICT 1:1 (perm.replication.*) ──
  { code: 'perm.replication.job.create', domain: 'replication', resource: 'job', action: 'create', description: 'Create replication jobs' },
  { code: 'perm.replication.job.read', domain: 'replication', resource: 'job', action: 'read', description: 'View replication jobs' },
  { code: 'perm.replication.job.execute', domain: 'replication', resource: 'job', action: 'execute', description: 'Execute replication' },
  { code: 'perm.replication.evidence.read', domain: 'replication', resource: 'evidence', action: 'read', description: 'View evidence packs' },
  { code: 'perm.replication.evidence.validate', domain: 'replication', resource: 'evidence', action: 'validate', description: 'Validate evidence' },
  { code: 'perm.replication.tool.execute', domain: 'replication', resource: 'tool', action: 'execute', description: 'Execute replication tools' },

  // ── Localization (perm.localization.*) ──
  { code: 'perm.localization.translation.create', domain: 'localization', resource: 'translation', action: 'create', description: 'Create translations' },
  { code: 'perm.localization.translation.read', domain: 'localization', resource: 'translation', action: 'read', description: 'View translations' },
  { code: 'perm.localization.translation.update', domain: 'localization', resource: 'translation', action: 'update', description: 'Edit translations' },
  { code: 'perm.localization.translation.approve', domain: 'localization', resource: 'translation', action: 'approve', description: 'Approve translations' },

  // ── Conversion (perm.conversion.*) ──
  { code: 'perm.conversion.job.create', domain: 'conversion', resource: 'job', action: 'create', description: 'Create conversion jobs' },
  { code: 'perm.conversion.job.read', domain: 'conversion', resource: 'job', action: 'read', description: 'View conversion jobs' },
  { code: 'perm.conversion.job.execute', domain: 'conversion', resource: 'job', action: 'execute', description: 'Execute conversions' },

  // ── AI Intelligence (perm.ai.*) ──
  { code: 'perm.ai.query.execute', domain: 'ai', resource: 'query', action: 'execute', description: 'Execute AI queries' },
  { code: 'perm.ai.agent.manage', domain: 'ai', resource: 'agent', action: 'manage', description: 'Manage AI agents' },
  { code: 'perm.ai.model.configure', domain: 'ai', resource: 'model', action: 'configure', description: 'Configure AI models' },
  { code: 'perm.ai.analysis.create', domain: 'ai', resource: 'analysis', action: 'create', description: 'Create AI analyses' },
  { code: 'perm.ai.analysis.read', domain: 'ai', resource: 'analysis', action: 'read', description: 'View AI analysis results' },

  // ── Governance (perm.governance.*) ──
  { code: 'perm.governance.audit.read', domain: 'governance', resource: 'audit', action: 'read', description: 'View audit logs' },
  { code: 'perm.governance.audit.export', domain: 'governance', resource: 'audit', action: 'export', description: 'Export audit logs' },
  { code: 'perm.governance.policy.create', domain: 'governance', resource: 'policy', action: 'create', description: 'Create policies' },
  { code: 'perm.governance.policy.read', domain: 'governance', resource: 'policy', action: 'read', description: 'View policies' },
  { code: 'perm.governance.policy.update', domain: 'governance', resource: 'policy', action: 'update', description: 'Update policies' },
  { code: 'perm.governance.policy.delete', domain: 'governance', resource: 'policy', action: 'delete', description: 'Delete policies' },
  { code: 'perm.governance.workflow.create', domain: 'governance', resource: 'workflow', action: 'create', description: 'Create workflows' },
  { code: 'perm.governance.workflow.manage', domain: 'governance', resource: 'workflow', action: 'manage', description: 'Manage workflows' },
  { code: 'perm.governance.workflow.approve', domain: 'governance', resource: 'workflow', action: 'approve', description: 'Approve workflow steps' },
  { code: 'perm.governance.compliance.read', domain: 'governance', resource: 'compliance', action: 'read', description: 'View compliance status' },
  { code: 'perm.governance.compliance.manage', domain: 'governance', resource: 'compliance', action: 'manage', description: 'Manage compliance checks' },
  { code: 'perm.governance.retention.manage', domain: 'governance', resource: 'retention', action: 'manage', description: 'Manage retention policies' },
  { code: 'perm.governance.encryption.manage', domain: 'governance', resource: 'encryption', action: 'manage', description: 'Manage encryption settings' },
  { code: 'perm.governance.backup.manage', domain: 'governance', resource: 'backup', action: 'manage', description: 'Manage backups' },
  { code: 'perm.governance.backup.restore', domain: 'governance', resource: 'backup', action: 'restore', description: 'Restore from backups' },

  // ── Library (perm.library.*) ──
  { code: 'perm.library.asset.create', domain: 'library', resource: 'asset', action: 'create', description: 'Upload library assets' },
  { code: 'perm.library.asset.read', domain: 'library', resource: 'asset', action: 'read', description: 'View library assets' },
  { code: 'perm.library.asset.update', domain: 'library', resource: 'asset', action: 'update', description: 'Update library assets' },
  { code: 'perm.library.asset.delete', domain: 'library', resource: 'asset', action: 'delete', description: 'Delete library assets' },
  { code: 'perm.library.folder.manage', domain: 'library', resource: 'folder', action: 'manage', description: 'Manage folders' },

  // ── Template (perm.template.*) ──
  { code: 'perm.template.template.create', domain: 'template', resource: 'template', action: 'create', description: 'Create templates' },
  { code: 'perm.template.template.read', domain: 'template', resource: 'template', action: 'read', description: 'View templates' },
  { code: 'perm.template.template.update', domain: 'template', resource: 'template', action: 'update', description: 'Edit templates' },
  { code: 'perm.template.template.delete', domain: 'template', resource: 'template', action: 'delete', description: 'Delete templates' },
  { code: 'perm.template.template.publish', domain: 'template', resource: 'template', action: 'publish', description: 'Publish templates' },

  // ── Admin (perm.admin.*) ──
  { code: 'perm.admin.user.create', domain: 'admin', resource: 'user', action: 'create', description: 'Create users' },
  { code: 'perm.admin.user.read', domain: 'admin', resource: 'user', action: 'read', description: 'View users' },
  { code: 'perm.admin.user.update', domain: 'admin', resource: 'user', action: 'update', description: 'Edit users' },
  { code: 'perm.admin.user.delete', domain: 'admin', resource: 'user', action: 'delete', description: 'Delete users' },
  { code: 'perm.admin.user.suspend', domain: 'admin', resource: 'user', action: 'suspend', description: 'Suspend users' },
  { code: 'perm.admin.role.create', domain: 'admin', resource: 'role', action: 'create', description: 'Create roles' },
  { code: 'perm.admin.role.read', domain: 'admin', resource: 'role', action: 'read', description: 'View roles' },
  { code: 'perm.admin.role.update', domain: 'admin', resource: 'role', action: 'update', description: 'Edit roles' },
  { code: 'perm.admin.role.delete', domain: 'admin', resource: 'role', action: 'delete', description: 'Delete roles' },
  { code: 'perm.admin.role.assign', domain: 'admin', resource: 'role', action: 'assign', description: 'Assign roles to users' },
  { code: 'perm.admin.tenant.manage', domain: 'admin', resource: 'tenant', action: 'manage', description: 'Manage tenant settings' },
  { code: 'perm.admin.system.configure', domain: 'admin', resource: 'system', action: 'configure', description: 'Configure system settings' },
  { code: 'perm.admin.feature.manage', domain: 'admin', resource: 'feature', action: 'manage', description: 'Manage feature flags' },
  { code: 'perm.admin.webhook.manage', domain: 'admin', resource: 'webhook', action: 'manage', description: 'Manage webhooks' },
  { code: 'perm.admin.notification.manage', domain: 'admin', resource: 'notification', action: 'manage', description: 'Manage notifications' },
  { code: 'perm.admin.integration.manage', domain: 'admin', resource: 'integration', action: 'manage', description: 'Manage integrations' },

  // ── Collaboration (perm.collab.*) ──
  { code: 'perm.collab.session.create', domain: 'collab', resource: 'session', action: 'create', description: 'Start collaboration sessions' },
  { code: 'perm.collab.session.join', domain: 'collab', resource: 'session', action: 'join', description: 'Join collaboration sessions' },
  { code: 'perm.collab.comment.create', domain: 'collab', resource: 'comment', action: 'create', description: 'Add comments' },
  { code: 'perm.collab.comment.delete', domain: 'collab', resource: 'comment', action: 'delete', description: 'Delete comments' },
  { code: 'perm.collab.share.manage', domain: 'collab', resource: 'share', action: 'manage', description: 'Manage sharing settings' },
];

// GP-0319→GP-0328: 10 default roles
export interface RoleDef {
  name: string;
  displayName: string;
  displayNameAr: string;
  description: string;
  priority: number;
  permissions: string[];
}

const ALL_PERMISSIONS = SYSTEM_PERMISSIONS.map((p) => p.code);

const READ_PERMISSIONS = SYSTEM_PERMISSIONS
  .filter((p) => ['read', 'execute'].includes(p.action))
  .map((p) => p.code);

const EDITOR_PERMISSIONS = SYSTEM_PERMISSIONS
  .filter((p) => !p.code.startsWith('perm.admin.') && !p.code.startsWith('perm.governance.'))
  .map((p) => p.code);

const ANALYST_PERMISSIONS = [
  ...READ_PERMISSIONS,
  'perm.data.dataset.create', 'perm.data.dataset.update',
  'perm.excel.workbook.create', 'perm.excel.workbook.update', 'perm.excel.formula.execute',
  'perm.excel.pivot.manage',
  'perm.dashboard.board.create', 'perm.dashboard.board.update', 'perm.dashboard.kpi.create',
  'perm.dashboard.kpi.update',
  'perm.report.report.create', 'perm.report.report.update', 'perm.report.report.export',
  'perm.ai.query.execute', 'perm.ai.analysis.create',
];

const MANAGER_PERMISSIONS = [
  ...EDITOR_PERMISSIONS,
  'perm.governance.audit.read', 'perm.governance.policy.read',
  'perm.governance.workflow.approve', 'perm.governance.compliance.read',
  'perm.admin.user.read', 'perm.admin.role.read',
  'perm.dashboard.kpi.approve',
  'perm.report.report.publish', 'perm.report.report.schedule',
  'perm.dashboard.board.publish',
];

const ADMIN_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  'perm.admin.user.create', 'perm.admin.user.update', 'perm.admin.user.suspend',
  'perm.admin.role.create', 'perm.admin.role.update', 'perm.admin.role.assign',
  'perm.admin.feature.manage', 'perm.admin.webhook.manage',
  'perm.admin.notification.manage',
  'perm.governance.policy.create', 'perm.governance.policy.update',
  'perm.governance.workflow.create', 'perm.governance.workflow.manage',
  'perm.governance.audit.export', 'perm.governance.compliance.manage',
  'perm.governance.backup.manage',
];

export const DEFAULT_ROLES: RoleDef[] = [
  {
    name: 'owner',
    displayName: 'Organization Owner',
    displayNameAr: 'مالك المؤسسة',
    description: 'Full access to everything. Cannot be modified or deleted.',
    priority: 100,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'org_admin',
    displayName: 'Organization Admin',
    displayNameAr: 'مدير المؤسسة',
    description: 'Full administrative access except owner-level operations.',
    priority: 90,
    permissions: ADMIN_PERMISSIONS,
  },
  {
    name: 'security_admin',
    displayName: 'Security Admin',
    displayNameAr: 'مدير الأمان',
    description: 'Manages security policies, audit, compliance, and encryption.',
    priority: 85,
    permissions: [
      ...READ_PERMISSIONS,
      'perm.governance.audit.read', 'perm.governance.audit.export',
      'perm.governance.policy.create', 'perm.governance.policy.read',
      'perm.governance.policy.update', 'perm.governance.policy.delete',
      'perm.governance.compliance.read', 'perm.governance.compliance.manage',
      'perm.governance.encryption.manage', 'perm.governance.retention.manage',
      'perm.governance.backup.manage', 'perm.governance.backup.restore',
      'perm.admin.user.read', 'perm.admin.user.suspend',
      'perm.admin.role.read',
    ],
  },
  {
    name: 'data_steward',
    displayName: 'Data Steward',
    displayNameAr: 'أمين البيانات',
    description: 'Manages data quality, classification, and governance.',
    priority: 80,
    permissions: [
      ...READ_PERMISSIONS,
      'perm.data.dataset.create', 'perm.data.dataset.update', 'perm.data.dataset.classify',
      'perm.data.dataset.mask', 'perm.data.dataset.anonymize',
      'perm.data.connector.create', 'perm.data.connector.manage',
      'perm.governance.policy.read', 'perm.governance.compliance.read',
    ],
  },
  {
    name: 'manager',
    displayName: 'Manager',
    displayNameAr: 'مدير',
    description: 'Can manage content, approve workflows, and view governance.',
    priority: 70,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    name: 'analyst',
    displayName: 'Analyst',
    displayNameAr: 'محلل',
    description: 'Can create and analyze data, dashboards, and reports.',
    priority: 60,
    permissions: ANALYST_PERMISSIONS,
  },
  {
    name: 'editor',
    displayName: 'Editor',
    displayNameAr: 'محرر',
    description: 'Can create and edit content across all engines.',
    priority: 50,
    permissions: EDITOR_PERMISSIONS,
  },
  {
    name: 'contributor',
    displayName: 'Contributor',
    displayNameAr: 'مساهم',
    description: 'Can create content but not publish or share.',
    priority: 40,
    permissions: SYSTEM_PERMISSIONS
      .filter((p) => ['create', 'read', 'update', 'execute'].includes(p.action)
        && !p.code.startsWith('perm.admin.')
        && !p.code.startsWith('perm.governance.'))
      .map((p) => p.code),
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    displayNameAr: 'مشاهد',
    description: 'Read-only access to shared content.',
    priority: 10,
    permissions: READ_PERMISSIONS,
  },
  {
    name: 'guest',
    displayName: 'Guest',
    displayNameAr: 'ضيف',
    description: 'Minimal access to explicitly shared items only.',
    priority: 1,
    permissions: [
      'perm.data.file.read',
      'perm.dashboard.board.read',
      'perm.report.report.read',
      'perm.presentation.slide.read',
    ],
  },
];
