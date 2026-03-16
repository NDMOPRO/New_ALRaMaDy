/**
 * محول PrismaClient → sql.js
 * يوفر واجهة متوافقة مع PrismaClient لكنه يستخدم sql.js داخليًا
 * هذا يسمح للخدمات المنقولة من الحزمة المرجعية بالعمل بدون تعديل
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface ModelDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }): Promise<Record<string, unknown>[]>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
  upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

/**
 * إنشاء delegate لجدول معين يعمل مع sql.js
 */
function createModelDelegate(getDb: () => unknown, tableName: string): ModelDelegate {
  const ensureTable = (db: any) => {
    try {
      db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`);
    } catch {
      // الجدول موجود مسبقًا
    }
  };

  return {
    async create(args) {
      const db = getDb() as any;
      ensureTable(db);
      const id = (args.data.id as string) || crypto.randomUUID();
      const data = JSON.stringify({ ...args.data, id });
      db.run(`INSERT INTO "${tableName}" (id, data) VALUES (?, ?)`, [id, data]);
      return { ...args.data, id };
    },

    async findUnique(args) {
      const db = getDb() as any;
      ensureTable(db);
      const key = Object.keys(args.where)[0];
      const value = args.where[key];
      const results = db.exec(`SELECT data FROM "${tableName}" WHERE json_extract(data, '$.${key}') = ?`, [value]);
      if (!results.length || !results[0].values.length) return null;
      return JSON.parse(results[0].values[0][0] as string);
    },

    async findMany(args) {
      const db = getDb() as any;
      ensureTable(db);
      let query = `SELECT data FROM "${tableName}"`;
      const params: unknown[] = [];

      if (args?.where) {
        const conditions = Object.entries(args.where).map(([key, value]) => {
          params.push(value);
          return `json_extract(data, '$.${key}') = ?`;
        });
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
      }

      if (args?.orderBy) {
        const [key, dir] = Object.entries(args.orderBy)[0];
        query += ` ORDER BY json_extract(data, '$.${key}') ${dir === 'desc' ? 'DESC' : 'ASC'}`;
      }

      if (args?.take) {
        query += ` LIMIT ${args.take}`;
      }

      const results = db.exec(query, params);
      if (!results.length) return [];
      return results[0].values.map((row: unknown[]) => JSON.parse(row[0] as string));
    },

    async update(args) {
      const db = getDb() as any;
      ensureTable(db);
      const key = Object.keys(args.where)[0];
      const value = args.where[key];
      const existing = await this.findUnique(args);
      if (!existing) throw new Error(`Record not found in ${tableName}`);
      const updated = { ...existing, ...args.data };
      const data = JSON.stringify(updated);
      db.run(`UPDATE "${tableName}" SET data = ?, updated_at = datetime('now') WHERE json_extract(data, '$.${key}') = ?`, [data, value]);
      return updated;
    },

    async delete(args) {
      const db = getDb() as any;
      ensureTable(db);
      const key = Object.keys(args.where)[0];
      const value = args.where[key];
      const existing = await this.findUnique(args);
      db.run(`DELETE FROM "${tableName}" WHERE json_extract(data, '$.${key}') = ?`, [value]);
      return existing || {};
    },

    async upsert(args) {
      const existing = await this.findUnique({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update });
      }
      return this.create({ data: args.create });
    }
  };
}

/**
 * PrismaClient المتوافق مع sql.js
 * يوفر نفس الواجهة التي تستخدمها الخدمات المرجعية
 */
export class PrismaClient {
  private _getDb: () => unknown;

  // نماذج الجداول المطلوبة من الخدمات المرجعية
  replicationJob: ModelDelegate;
  comparisonResult: ModelDelegate;
  document: ModelDelegate;
  fidelityReport: ModelDelegate;
  fontCache: ModelDelegate;
  qualityReport: ModelDelegate;
  replicaRecord: ModelDelegate;
  templateRecord: ModelDelegate;
  auditLog: ModelDelegate;
  governanceRule: ModelDelegate;
  featureFlag: ModelDelegate;
  rbacRole: ModelDelegate;
  rbacPermission: ModelDelegate;
  excelWorkbook: ModelDelegate;
  excelFormula: ModelDelegate;
  chartConfig: ModelDelegate;
  aiPrompt: ModelDelegate;
  aiResponse: ModelDelegate;

  constructor(getDb?: () => unknown) {
    // إذا لم يتم تمرير getDb، نستخدم مخزن في الذاكرة
    this._getDb = getDb || (() => {
      throw new Error('Database not initialized. Pass getDb function to PrismaClient constructor.');
    });

    // إنشاء delegates لجميع الجداول
    this.replicationJob = createModelDelegate(this._getDb, 'replication_jobs');
    this.comparisonResult = createModelDelegate(this._getDb, 'comparison_results');
    this.document = createModelDelegate(this._getDb, 'documents');
    this.fidelityReport = createModelDelegate(this._getDb, 'fidelity_reports');
    this.fontCache = createModelDelegate(this._getDb, 'font_cache');
    this.qualityReport = createModelDelegate(this._getDb, 'quality_reports');
    this.replicaRecord = createModelDelegate(this._getDb, 'replica_records');
    this.templateRecord = createModelDelegate(this._getDb, 'template_records');
    this.auditLog = createModelDelegate(this._getDb, 'audit_logs');
    this.governanceRule = createModelDelegate(this._getDb, 'governance_rules');
    this.featureFlag = createModelDelegate(this._getDb, 'feature_flags');
    this.rbacRole = createModelDelegate(this._getDb, 'rbac_roles');
    this.rbacPermission = createModelDelegate(this._getDb, 'rbac_permissions');
    this.excelWorkbook = createModelDelegate(this._getDb, 'excel_workbooks');
    this.excelFormula = createModelDelegate(this._getDb, 'excel_formulas');
    this.chartConfig = createModelDelegate(this._getDb, 'chart_configs');
    this.aiPrompt = createModelDelegate(this._getDb, 'ai_prompts');
    this.aiResponse = createModelDelegate(this._getDb, 'ai_responses');
  }

  async $connect(): Promise<void> {
    // sql.js لا يحتاج اتصال صريح
  }

  async $disconnect(): Promise<void> {
    // sql.js لا يحتاج فصل صريح
  }

  async $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    // تنفيذ المعاملة مباشرة (sql.js يدعم المعاملات)
    return fn(this);
  }
}

// تصدير Prisma namespace للتوافق مع الاستيرادات
export namespace Prisma {
  export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
  export type InputJsonValue = JsonValue;
}

// تصدير افتراضي للتوافق مع استيراد PrismaClient الأصلي
export default { PrismaClient, Prisma };
