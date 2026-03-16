/**
 * RASID Platform - Database Adapter Layer
 *
 * Provides a Prisma-compatible interface backed by sql.js (SQLite).
 * This adapter allows seed code that was written for Prisma to work
 * seamlessly with the existing sql.js infrastructure in the repo.
 *
 * Usage:
 *   Instead of: import { PrismaClient } from '@prisma/client';
 *   Use:        import { createDbAdapter, type DbAdapter } from '@rasid/contracts';
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T>;
  findMany<T = Record<string, unknown>>(table: string, options?: FindManyOptions): Promise<T[]>;
  findUnique<T = Record<string, unknown>>(table: string, where: Record<string, unknown>): Promise<T | null>;
  create<T = Record<string, unknown>>(table: string, data: Record<string, unknown>): Promise<T>;
  update<T = Record<string, unknown>>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T>;
  delete(table: string, where: Record<string, unknown>): Promise<{ count: number }>;
  count(table: string, where?: Record<string, unknown>): Promise<number>;
  upsert<T = Record<string, unknown>>(table: string, where: Record<string, unknown>, create: Record<string, unknown>, update: Record<string, unknown>): Promise<T>;
}

export interface FindManyOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Prisma-compatible query builder helpers
// ---------------------------------------------------------------------------

function buildWhereClause(where?: Record<string, unknown>): { sql: string; params: unknown[] } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else if (typeof value === "object" && value !== null) {
      const op = value as Record<string, unknown>;
      if ("in" in op && Array.isArray(op.in)) {
        const placeholders = op.in.map(() => "?").join(",");
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...op.in);
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

function buildOrderByClause(orderBy?: Record<string, "asc" | "desc">): string {
  if (!orderBy || Object.keys(orderBy).length === 0) return "";
  const parts = Object.entries(orderBy).map(([key, dir]) => `${key} ${dir.toUpperCase()}`);
  return ` ORDER BY ${parts.join(", ")}`;
}

function buildSelectClause(select?: Record<string, boolean>): string {
  if (!select) return "*";
  const fields = Object.entries(select)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return fields.length > 0 ? fields.join(", ") : "*";
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Creates a DbAdapter that wraps the existing sql.js query/run functions
 * from localDb.ts, providing a Prisma-like interface.
 *
 * @param queryFn - The existing query function from localDb
 * @param runFn - The existing run function from localDb
 */
export function createDbAdapter(
  queryFn: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
  runFn: (sql: string, params?: unknown[]) => Promise<void>
): DbAdapter {
  const adapter: DbAdapter = {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return queryFn(sql, params) as Promise<T[]>;
    },

    async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
      await runFn(sql, params);
      return { changes: 1 };
    },

    async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const rows = await queryFn(sql, params);
      return (rows[0] as T) || null;
    },

    async transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T> {
      await runFn("BEGIN TRANSACTION");
      try {
        const result = await fn(adapter);
        await runFn("COMMIT");
        return result;
      } catch (error) {
        await runFn("ROLLBACK");
        throw error;
      }
    },

    async findMany<T>(table: string, options?: FindManyOptions): Promise<T[]> {
      const select = buildSelectClause(options?.select);
      const { sql: whereSql, params } = buildWhereClause(options?.where);
      const orderBy = buildOrderByClause(options?.orderBy);
      let sql = `SELECT ${select} FROM ${table}${whereSql}${orderBy}`;
      if (options?.take) sql += ` LIMIT ${options.take}`;
      if (options?.skip) sql += ` OFFSET ${options.skip}`;
      return queryFn(sql, params) as Promise<T[]>;
    },

    async findUnique<T>(table: string, where: Record<string, unknown>): Promise<T | null> {
      const { sql: whereSql, params } = buildWhereClause(where);
      const rows = await queryFn(`SELECT * FROM ${table}${whereSql} LIMIT 1`, params);
      return (rows[0] as T) || null;
    },

    async create<T>(table: string, data: Record<string, unknown>): Promise<T> {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => "?").join(", ");
      await runFn(
        `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
        values
      );
      const rows = await queryFn(
        `SELECT * FROM ${table} WHERE rowid = last_insert_rowid()`
      );
      return rows[0] as T;
    },

    async update<T>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T> {
      const sets = Object.keys(data).map((k) => `${k} = ?`);
      const { sql: whereSql, params: whereParams } = buildWhereClause(where);
      await runFn(
        `UPDATE ${table} SET ${sets.join(", ")}${whereSql}`,
        [...Object.values(data), ...whereParams]
      );
      const rows = await queryFn(`SELECT * FROM ${table}${whereSql}`, whereParams);
      return rows[0] as T;
    },

    async delete(table: string, where: Record<string, unknown>): Promise<{ count: number }> {
      const { sql: whereSql, params } = buildWhereClause(where);
      await runFn(`DELETE FROM ${table}${whereSql}`, params);
      return { count: 1 };
    },

    async count(table: string, where?: Record<string, unknown>): Promise<number> {
      const { sql: whereSql, params } = buildWhereClause(where);
      const rows = await queryFn(`SELECT COUNT(*) as count FROM ${table}${whereSql}`, params);
      return Number((rows[0] as any)?.count || 0);
    },

    async upsert<T>(table: string, where: Record<string, unknown>, createData: Record<string, unknown>, updateData: Record<string, unknown>): Promise<T> {
      const existing = await adapter.findUnique(table, where);
      if (existing) {
        return adapter.update<T>(table, where, updateData);
      }
      return adapter.create<T>(table, { ...where, ...createData });
    },
  };

  return adapter;
}

// ---------------------------------------------------------------------------
// Migration helper for creating tables
// ---------------------------------------------------------------------------

export interface TableSchema {
  name: string;
  columns: ColumnDef[];
  indexes?: IndexDef[];
}

export interface ColumnDef {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "BOOLEAN";
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: string | number | null;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
}

export function generateCreateTableSQL(schema: TableSchema): string {
  const cols = schema.columns.map((col) => {
    let def = `${col.name} ${col.type}`;
    if (col.primaryKey) def += " PRIMARY KEY";
    if (col.autoIncrement) def += " AUTOINCREMENT";
    if (col.notNull) def += " NOT NULL";
    if (col.unique) def += " UNIQUE";
    if (col.defaultValue !== undefined) {
      def += ` DEFAULT ${typeof col.defaultValue === "string" ? `'${col.defaultValue}'` : col.defaultValue}`;
    }
    return def;
  });

  let sql = `CREATE TABLE IF NOT EXISTS ${schema.name} (\n  ${cols.join(",\n  ")}\n)`;

  if (schema.indexes) {
    for (const idx of schema.indexes) {
      const unique = idx.unique ? "UNIQUE " : "";
      sql += `;\nCREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${schema.name} (${idx.columns.join(", ")})`;
    }
  }

  return sql;
}
