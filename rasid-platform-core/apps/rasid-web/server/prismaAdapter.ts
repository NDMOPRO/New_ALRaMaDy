/**
 * Prisma Adapter — Drop-in replacement for PrismaClient
 *
 * Provides a PrismaClient-compatible interface backed by the existing
 * sql.js database (localDb). This allows seed code that imports
 * PrismaClient to work without any Prisma installation.
 *
 * Usage in adapted seed code:
 *   import { prisma } from '../prismaAdapter';
 *   // Then use prisma.auditLog.findMany(...) etc.
 */

import { query, run } from "./localDb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhereClause {
  [key: string]: unknown;
}

interface OrderByClause {
  [key: string]: "asc" | "desc";
}

interface FindManyArgs {
  where?: WhereClause;
  orderBy?: OrderByClause | OrderByClause[];
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
}

interface FindUniqueArgs {
  where: WhereClause;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
}

interface CreateArgs {
  data: Record<string, unknown>;
  select?: Record<string, boolean>;
}

interface UpdateArgs {
  where: WhereClause;
  data: Record<string, unknown>;
  select?: Record<string, boolean>;
}

interface UpdateManyArgs {
  where: WhereClause;
  data: Record<string, unknown>;
}

interface DeleteArgs {
  where: WhereClause;
}

interface CreateManyArgs {
  data: Record<string, unknown>[];
  skipDuplicates?: boolean;
}

interface CountArgs {
  where?: WhereClause;
}

interface UpsertArgs {
  where: WhereClause;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SQL Builder helpers
// ---------------------------------------------------------------------------

function buildWhere(where?: WhereClause): { sql: string; params: unknown[] } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === null || value === undefined) {
      conditions.push(`${key} IS NULL`);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;
      if ("in" in op && Array.isArray(op.in)) {
        if (op.in.length === 0) {
          conditions.push("1=0");
        } else {
          const ph = op.in.map(() => "?").join(",");
          conditions.push(`${key} IN (${ph})`);
          params.push(...op.in);
        }
      } else if ("notIn" in op && Array.isArray(op.notIn)) {
        if (op.notIn.length === 0) {
          conditions.push("1=1");
        } else {
          const ph = op.notIn.map(() => "?").join(",");
          conditions.push(`${key} NOT IN (${ph})`);
          params.push(...op.notIn);
        }
      } else if ("not" in op) {
        if (op.not === null) {
          conditions.push(`${key} IS NOT NULL`);
        } else {
          conditions.push(`${key} != ?`);
          params.push(op.not);
        }
      } else if ("gte" in op) {
        conditions.push(`${key} >= ?`);
        params.push(op.gte);
      } else if ("lte" in op) {
        conditions.push(`${key} <= ?`);
        params.push(op.lte);
      } else if ("gt" in op) {
        conditions.push(`${key} > ?`);
        params.push(op.gt);
      } else if ("lt" in op) {
        conditions.push(`${key} < ?`);
        params.push(op.lt);
      } else if ("contains" in op) {
        conditions.push(`${key} LIKE ?`);
        params.push(`%${op.contains}%`);
      } else if ("startsWith" in op) {
        conditions.push(`${key} LIKE ?`);
        params.push(`${op.startsWith}%`);
      } else if ("endsWith" in op) {
        conditions.push(`${key} LIKE ?`);
        params.push(`%${op.endsWith}`);
      } else if ("equals" in op) {
        conditions.push(`${key} = ?`);
        params.push(op.equals);
      }
    } else {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  }

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function buildOrderBy(orderBy?: OrderByClause | OrderByClause[]): string {
  if (!orderBy) return "";
  const clauses: string[] = [];
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const item of items) {
    for (const [key, dir] of Object.entries(item)) {
      clauses.push(`${key} ${dir.toUpperCase()}`);
    }
  }
  return clauses.length > 0 ? ` ORDER BY ${clauses.join(", ")}` : "";
}

function buildSelect(select?: Record<string, boolean>): string {
  if (!select) return "*";
  const fields = Object.entries(select)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return fields.length > 0 ? fields.join(", ") : "*";
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

// ---------------------------------------------------------------------------
// Model proxy factory
// ---------------------------------------------------------------------------

function createModelProxy(tableName: string) {
  return {
    async findMany(args?: FindManyArgs): Promise<Record<string, unknown>[]> {
      const sel = buildSelect(args?.select);
      const { sql: whereSql, params } = buildWhere(args?.where);
      const orderBy = buildOrderBy(args?.orderBy);
      let sql = `SELECT ${sel} FROM ${tableName}${whereSql}${orderBy}`;
      if (args?.take) sql += ` LIMIT ${args.take}`;
      if (args?.skip) sql += ` OFFSET ${args.skip}`;
      return query(sql, params);
    },

    async findUnique(args: FindUniqueArgs): Promise<Record<string, unknown> | null> {
      const sel = buildSelect(args?.select);
      const { sql: whereSql, params } = buildWhere(args.where);
      const rows = await query(`SELECT ${sel} FROM ${tableName}${whereSql} LIMIT 1`, params);
      return rows[0] || null;
    },

    async findFirst(args?: FindManyArgs): Promise<Record<string, unknown> | null> {
      const sel = buildSelect(args?.select);
      const { sql: whereSql, params } = buildWhere(args?.where);
      const orderBy = buildOrderBy(args?.orderBy);
      const rows = await query(`SELECT ${sel} FROM ${tableName}${whereSql}${orderBy} LIMIT 1`, params);
      return rows[0] || null;
    },

    async create(args: CreateArgs): Promise<Record<string, unknown>> {
      const data = args.data;
      const keys = Object.keys(data);
      const values = keys.map((k) => serializeValue(data[k]));
      const placeholders = keys.map(() => "?").join(", ");
      await run(
        `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
        values
      );
      const rows = await query(
        `SELECT * FROM ${tableName} WHERE rowid = last_insert_rowid()`
      );
      return rows[0] || data;
    },

    async createMany(args: CreateManyArgs): Promise<{ count: number }> {
      let count = 0;
      for (const item of args.data) {
        try {
          const keys = Object.keys(item);
          const values = keys.map((k) => serializeValue(item[k]));
          const placeholders = keys.map(() => "?").join(", ");
          const orIgnore = args.skipDuplicates ? "OR IGNORE " : "";
          await run(
            `INSERT ${orIgnore}INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
            values
          );
          count++;
        } catch {
          if (!args.skipDuplicates) throw new Error(`Failed to insert into ${tableName}`);
        }
      }
      return { count };
    },

    async update(args: UpdateArgs): Promise<Record<string, unknown>> {
      const data = args.data;
      const sets = Object.keys(data).map((k) => `${k} = ?`);
      const setValues = Object.keys(data).map((k) => serializeValue(data[k]));
      const { sql: whereSql, params: whereParams } = buildWhere(args.where);
      await run(
        `UPDATE ${tableName} SET ${sets.join(", ")}${whereSql}`,
        [...setValues, ...whereParams]
      );
      const rows = await query(`SELECT * FROM ${tableName}${whereSql}`, whereParams);
      return rows[0] || { ...args.where, ...data };
    },

    async updateMany(args: UpdateManyArgs): Promise<{ count: number }> {
      const data = args.data;
      const sets = Object.keys(data).map((k) => `${k} = ?`);
      const setValues = Object.keys(data).map((k) => serializeValue(data[k]));
      const { sql: whereSql, params: whereParams } = buildWhere(args.where);
      await run(
        `UPDATE ${tableName} SET ${sets.join(", ")}${whereSql}`,
        [...setValues, ...whereParams]
      );
      return { count: 1 };
    },

    async delete(args: DeleteArgs): Promise<Record<string, unknown>> {
      const { sql: whereSql, params } = buildWhere(args.where);
      const rows = await query(`SELECT * FROM ${tableName}${whereSql} LIMIT 1`, params);
      await run(`DELETE FROM ${tableName}${whereSql}`, params);
      return rows[0] || {};
    },

    async deleteMany(args?: { where?: WhereClause }): Promise<{ count: number }> {
      const { sql: whereSql, params } = buildWhere(args?.where);
      await run(`DELETE FROM ${tableName}${whereSql}`, params);
      return { count: 1 };
    },

    async count(args?: CountArgs): Promise<number> {
      const { sql: whereSql, params } = buildWhere(args?.where);
      const rows = await query(`SELECT COUNT(*) as count FROM ${tableName}${whereSql}`, params);
      return Number((rows[0] as any)?.count || 0);
    },

    async upsert(args: UpsertArgs): Promise<Record<string, unknown>> {
      const existing = await this.findUnique({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update });
      }
      return this.create({ data: { ...args.where, ...args.create } });
    },

    async aggregate(args: { where?: WhereClause; _count?: boolean; _sum?: Record<string, boolean>; _avg?: Record<string, boolean>; _min?: Record<string, boolean>; _max?: Record<string, boolean> }): Promise<Record<string, unknown>> {
      const { sql: whereSql, params } = buildWhere(args.where);
      const result: Record<string, unknown> = {};

      if (args._count) {
        const rows = await query(`SELECT COUNT(*) as _count FROM ${tableName}${whereSql}`, params);
        result._count = Number((rows[0] as any)?._count || 0);
      }

      for (const [aggType, fields] of [
        ["SUM", args._sum],
        ["AVG", args._avg],
        ["MIN", args._min],
        ["MAX", args._max],
      ] as [string, Record<string, boolean> | undefined][]) {
        if (fields) {
          const aggResult: Record<string, unknown> = {};
          for (const [field, enabled] of Object.entries(fields)) {
            if (enabled) {
              const rows = await query(
                `SELECT ${aggType}(${field}) as val FROM ${tableName}${whereSql}`,
                params
              );
              aggResult[field] = (rows[0] as any)?.val;
            }
          }
          result[`_${aggType.toLowerCase()}`] = aggResult;
        }
      }

      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Prisma-compatible client
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for PrismaClient.
 * Maps Prisma model names to sql.js table names.
 */
export const prisma = {
  // Governance & Audit
  auditLog: createModelProxy("audit_logs"),
  complianceCheck: createModelProxy("compliance_checks"),
  consentRecord: createModelProxy("consent_records"),
  retentionPolicy: createModelProxy("retention_policies"),
  featureFlag: createModelProxy("feature_flags"),
  featureFlagRule: createModelProxy("feature_flag_rules"),

  // Replication & Strict
  replicationJob: createModelProxy("replication_jobs"),
  comparisonResult: createModelProxy("comparison_results"),
  fidelityReport: createModelProxy("fidelity_reports"),
  brandStyleGuide: createModelProxy("brand_style_guides"),

  // Excel
  excelWorkbook: createModelProxy("excel_workbooks"),
  excelCell: createModelProxy("excel_cells"),
  workbook: createModelProxy("workbooks"),
  sheet: createModelProxy("sheets"),
  cell: createModelProxy("cells"),
  chart: createModelProxy("charts"),

  // Datasets
  dataset: createModelProxy("datasets"),
  datasetColumn: createModelProxy("dataset_columns"),
  dataRow: createModelProxy("data_rows"),

  // Documents
  document: createModelProxy("documents"),

  // Dashboard
  dashboard: createModelProxy("dashboards"),
  dashboardWidget: createModelProxy("dashboard_widgets"),

  // Presentations
  presentation: createModelProxy("presentations"),
  presentationSlide: createModelProxy("presentation_slides"),

  // Reports
  report: createModelProxy("reports"),

  // Templates
  template: createModelProxy("templates"),
  templateVersion: createModelProxy("template_versions"),
  templateRating: createModelProxy("template_ratings"),

  // Users & Auth
  user: createModelProxy("users"),
  userRole: createModelProxy("user_roles"),
  tenant: createModelProxy("tenants"),

  // Logs
  importLog: createModelProxy("import_logs"),
  exportLog: createModelProxy("export_logs"),

  // Files
  file: createModelProxy("files"),

  // Spreadsheets
  spreadsheet: createModelProxy("spreadsheets"),

  // Translations
  translation: createModelProxy("translations"),

  // Extractions
  extraction: createModelProxy("extractions"),

  // Chat
  chatHistory: createModelProxy("chat_history"),

  // Shared Presentations
  sharedPresentation: createModelProxy("shared_presentations"),

  // Transaction support
  async $transaction<T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    await run("BEGIN TRANSACTION");
    try {
      const result = await fn(prisma);
      await run("COMMIT");
      return result;
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }
  },

  // Raw query support
  async $queryRaw(sql: string, ...params: unknown[]): Promise<unknown[]> {
    return query(sql, params);
  },

  async $executeRaw(sql: string, ...params: unknown[]): Promise<number> {
    await run(sql, params);
    return 1;
  },

  // Connection management (no-ops for sql.js)
  async $connect(): Promise<void> {},
  async $disconnect(): Promise<void> {},
};

export type PrismaClientAdapter = typeof prisma;
