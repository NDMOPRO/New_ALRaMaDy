/**
 * Seed Migrations — Creates all tables required by the seed engine code
 *
 * These tables map to the Prisma models used in the seed services.
 * They are created in the existing sql.js database alongside the
 * original localDb tables.
 */

import { run, query } from "./localDb";

// ---------------------------------------------------------------------------
// Table creation SQL
// ---------------------------------------------------------------------------

const SEED_TABLES: string[] = [
  // ─── Governance & Audit ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    resource TEXT,
    resourceId TEXT,
    details TEXT,
    severity TEXT DEFAULT 'info',
    timestamp TEXT DEFAULT (datetime('now')),
    tenantId TEXT,
    correlationId TEXT,
    metadata TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`,

  `CREATE TABLE IF NOT EXISTS compliance_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkType TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    result TEXT,
    details TEXT,
    resourceId TEXT,
    resourceType TEXT,
    performedBy TEXT,
    performedAt TEXT DEFAULT (datetime('now')),
    expiresAt TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS consent_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    consentType TEXT NOT NULL,
    granted INTEGER DEFAULT 0,
    grantedAt TEXT,
    revokedAt TEXT,
    details TEXT,
    version TEXT DEFAULT '1.0'
  )`,

  `CREATE TABLE IF NOT EXISTS retention_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    resourceType TEXT NOT NULL,
    retentionDays INTEGER NOT NULL,
    action TEXT DEFAULT 'archive',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS feature_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER DEFAULT 0,
    percentage INTEGER DEFAULT 100,
    rules TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS feature_flag_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flagId INTEGER NOT NULL,
    ruleType TEXT NOT NULL,
    condition TEXT NOT NULL,
    value TEXT,
    priority INTEGER DEFAULT 0,
    FOREIGN KEY (flagId) REFERENCES feature_flags(id)
  )`,

  // ─── Replication & Strict Fidelity ──────────────────────────
  `CREATE TABLE IF NOT EXISTS replication_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'queued',
    sourceAsset TEXT,
    targetFormat TEXT,
    config TEXT,
    result TEXT,
    evidencePack TEXT,
    fidelityScore REAL,
    pixelMatch REAL,
    warnings TEXT,
    error TEXT,
    startedAt TEXT,
    completedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    userId TEXT,
    tenantId TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_replication_jobs_jobId ON replication_jobs(jobId)`,
  `CREATE INDEX IF NOT EXISTS idx_replication_jobs_status ON replication_jobs(status)`,

  `CREATE TABLE IF NOT EXISTS comparison_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    comparisonType TEXT NOT NULL,
    score REAL,
    details TEXT,
    diffImagePath TEXT,
    hotspots TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (jobId) REFERENCES replication_jobs(jobId)
  )`,

  `CREATE TABLE IF NOT EXISTS fidelity_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    overallScore REAL,
    layoutAccuracy REAL,
    colorFidelity REAL,
    typographyAccuracy REAL,
    contentCompleteness REAL,
    issues TEXT,
    recommendations TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (jobId) REFERENCES replication_jobs(jobId)
  )`,

  `CREATE TABLE IF NOT EXISTS brand_style_guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    colors TEXT,
    fonts TEXT,
    spacing TEXT,
    logos TEXT,
    guidelines TEXT,
    tenantId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // ─── Excel Engine ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS excel_workbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workbookId TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sheets TEXT,
    metadata TEXT,
    userId TEXT,
    tenantId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_excel_workbooks_userId ON excel_workbooks(userId)`,

  `CREATE TABLE IF NOT EXISTS excel_cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workbookId TEXT NOT NULL,
    sheetName TEXT NOT NULL,
    cellRef TEXT NOT NULL,
    value TEXT,
    formula TEXT,
    type TEXT DEFAULT 'text',
    format TEXT,
    style TEXT,
    FOREIGN KEY (workbookId) REFERENCES excel_workbooks(workbookId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_excel_cells_workbook ON excel_cells(workbookId, sheetName)`,

  `CREATE TABLE IF NOT EXISTS workbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    userId TEXT,
    sheetCount INTEGER DEFAULT 1,
    metadata TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS sheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workbookId INTEGER NOT NULL,
    name TEXT NOT NULL,
    index_num INTEGER DEFAULT 0,
    rowCount INTEGER DEFAULT 0,
    colCount INTEGER DEFAULT 0,
    metadata TEXT,
    FOREIGN KEY (workbookId) REFERENCES workbooks(id)
  )`,

  `CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sheetId INTEGER NOT NULL,
    row_num INTEGER NOT NULL,
    col_num INTEGER NOT NULL,
    value TEXT,
    formula TEXT,
    type TEXT DEFAULT 'text',
    format TEXT,
    style TEXT,
    FOREIGN KEY (sheetId) REFERENCES sheets(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cells_sheet ON cells(sheetId, row_num, col_num)`,

  `CREATE TABLE IF NOT EXISTS charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sheetId INTEGER,
    workbookId INTEGER,
    chartType TEXT NOT NULL,
    title TEXT,
    config TEXT,
    data TEXT,
    position TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // ─── Datasets ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datasetId TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT,
    format TEXT,
    rowCount INTEGER DEFAULT 0,
    columnCount INTEGER DEFAULT 0,
    metadata TEXT,
    userId TEXT,
    tenantId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_datasets_datasetId ON datasets(datasetId)`,

  `CREATE TABLE IF NOT EXISTS dataset_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datasetId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    nullable INTEGER DEFAULT 1,
    stats TEXT,
    FOREIGN KEY (datasetId) REFERENCES datasets(datasetId)
  )`,

  `CREATE TABLE IF NOT EXISTS data_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datasetId TEXT NOT NULL,
    rowIndex INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (datasetId) REFERENCES datasets(datasetId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_data_rows_dataset ON data_rows(datasetId)`,

  // ─── Documents ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    format TEXT,
    pageCount INTEGER DEFAULT 0,
    fileSize INTEGER DEFAULT 0,
    language TEXT DEFAULT 'ar',
    direction TEXT DEFAULT 'rtl',
    storagePath TEXT,
    metadata TEXT,
    userId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // ─── Dashboard Widgets ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboardId INTEGER NOT NULL,
    widgetType TEXT NOT NULL,
    title TEXT,
    config TEXT,
    position TEXT,
    dataBinding TEXT,
    style TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (dashboardId) REFERENCES dashboards(id)
  )`,

  // ─── Presentation Slides ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS presentation_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentationId INTEGER NOT NULL,
    slideIndex INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    layout TEXT,
    notes TEXT,
    transition TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (presentationId) REFERENCES presentations(id)
  )`,

  // ─── Reports Extended ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS report_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reportId INTEGER NOT NULL,
    sectionType TEXT NOT NULL,
    title TEXT,
    content TEXT,
    order_num INTEGER DEFAULT 0,
    metadata TEXT,
    FOREIGN KEY (reportId) REFERENCES reports(id)
  )`,

  // ─── Template Versions & Ratings ───────────────────────────
  `CREATE TABLE IF NOT EXISTS template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    templateId INTEGER NOT NULL,
    version TEXT NOT NULL,
    content TEXT,
    changelog TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    createdBy TEXT,
    FOREIGN KEY (templateId) REFERENCES templates(id)
  )`,

  `CREATE TABLE IF NOT EXISTS template_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    templateId INTEGER NOT NULL,
    userId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    review TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (templateId) REFERENCES templates(id)
  )`,

  // ─── User Roles ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT,
    grantedBy TEXT,
    grantedAt TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_roles_userId ON user_roles(userId)`,

  // ─── Tenants ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    nameAr TEXT,
    plan TEXT DEFAULT 'free',
    settings TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // ─── Import/Export Logs ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    format TEXT,
    status TEXT DEFAULT 'pending',
    rowCount INTEGER DEFAULT 0,
    errors TEXT,
    userId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    completedAt TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS export_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT NOT NULL,
    format TEXT,
    status TEXT DEFAULT 'pending',
    fileUrl TEXT,
    fileSize INTEGER DEFAULT 0,
    userId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    completedAt TEXT
  )`,
];

// ---------------------------------------------------------------------------
// Run migrations
// ---------------------------------------------------------------------------

export async function runSeedMigrations(): Promise<void> {
  console.log("[SeedMigrations] Starting seed table migrations...");
  let created = 0;
  let errors = 0;

  for (const sql of SEED_TABLES) {
    try {
      await run(sql);
      if (sql.startsWith("CREATE TABLE")) {
        created++;
      }
    } catch (err) {
      errors++;
      console.error(`[SeedMigrations] Error executing: ${sql.substring(0, 60)}...`, err);
    }
  }

  console.log(`[SeedMigrations] Complete: ${created} tables processed, ${errors} errors`);
}

// ---------------------------------------------------------------------------
// Verify migration
// ---------------------------------------------------------------------------

export async function verifySeedTables(): Promise<{
  total: number;
  existing: string[];
  missing: string[];
}> {
  const expectedTables = [
    "audit_logs", "compliance_checks", "consent_records", "retention_policies",
    "feature_flags", "feature_flag_rules", "replication_jobs", "comparison_results",
    "fidelity_reports", "brand_style_guides", "excel_workbooks", "excel_cells",
    "workbooks", "sheets", "cells", "charts", "datasets", "dataset_columns",
    "data_rows", "documents", "dashboard_widgets", "presentation_slides",
    "report_sections", "template_versions", "template_ratings", "user_roles",
    "tenants", "import_logs", "export_logs",
  ];

  const rows = await query(
    "SELECT name FROM sqlite_master WHERE type='table'",
    []
  );
  const existingNames = new Set(rows.map((r: any) => r.name));

  const existing = expectedTables.filter((t) => existingNames.has(t));
  const missing = expectedTables.filter((t) => !existingNames.has(t));

  return { total: expectedTables.length, existing, missing };
}
