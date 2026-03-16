/**
 * Local SQLite Database — self-contained, no external dependencies
 * ALL data stored locally in data/rasid.db
 */
// @ts-ignore — sql.js types may not be installed
import initSqlJs from "sql.js";
type SqlJsDatabase = any;
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "rasid.db");
let db: SqlJsDatabase | null = null;

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toObjects(results: { columns: string[]; values: any[][] }[]): Record<string, any>[] {
  if (results.length === 0) return [];
  const { columns, values } = results[0]!;
  return values.map((row: any[]) => {
    const obj: Record<string, any> = {};
    columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;
  ensureDir();
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  // Create ALL tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      displayName TEXT NOT NULL,
      email TEXT, mobile TEXT, role TEXT NOT NULL DEFAULT 'user',
      department TEXT, avatar TEXT, status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      lastSignedIn TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, title TEXT NOT NULL,
      type TEXT DEFAULT 'file', category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'ready', icon TEXT DEFAULT 'description',
      size TEXT, filePath TEXT, mimeType TEXT,
      metadata TEXT DEFAULT '{}', tags TEXT DEFAULT '[]',
      favorite INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, title TEXT NOT NULL,
      description TEXT, reportType TEXT DEFAULT 'general',
      sections TEXT DEFAULT '[]', classification TEXT DEFAULT 'عام',
      entity TEXT DEFAULT '', status TEXT DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, title TEXT NOT NULL,
      description TEXT, slides TEXT DEFAULT '[]',
      theme TEXT DEFAULT 'default', status TEXT DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, title TEXT NOT NULL,
      description TEXT, widgets TEXT DEFAULT '[]',
      layout TEXT DEFAULT '{}', status TEXT DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS spreadsheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, title TEXT NOT NULL,
      description TEXT, sheets TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, sessionId TEXT NOT NULL,
      role TEXT NOT NULL, content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, sourceText TEXT NOT NULL,
      translatedText TEXT NOT NULL, sourceLang TEXT DEFAULT 'ar',
      targetLang TEXT DEFAULT 'en', type TEXT DEFAULT 'translation',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, sourceType TEXT NOT NULL,
      sourceFile TEXT, extractedText TEXT,
      structuredData TEXT DEFAULT '{}', language TEXT DEFAULT 'ar',
      status TEXT DEFAULT 'completed',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS shared_presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentationId INTEGER NOT NULL, userId INTEGER NOT NULL,
      shareToken TEXT NOT NULL UNIQUE, password TEXT,
      title TEXT NOT NULL, slides TEXT DEFAULT '[]',
      theme TEXT DEFAULT 'default', brandKit TEXT DEFAULT '{}',
      isPublic INTEGER DEFAULT 1, viewCount INTEGER DEFAULT 0,
      expiresAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, category TEXT DEFAULT 'custom',
      scope TEXT DEFAULT 'personal', brandId TEXT DEFAULT 'custom',
      themeData TEXT DEFAULT '{}', slides TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]', createdBy INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ];

  tables.forEach(sql => db!.run(sql));
  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  ensureDir();
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ─── Generic helpers ─────────────────────
async function query(sql: string, params: any[] = []) {
  const database = await getDb();
  return toObjects(database.exec(sql, params));
}

async function run(sql: string, params: any[] = []) {
  const database = await getDb();
  database.run(sql, params);
  saveDb();
}

async function getLastId() {
  const database = await getDb();
  const r = database.exec("SELECT last_insert_rowid() as id");
  return toObjects(r)[0]?.id as number;
}

// ─── Users ───────────────────────────────
export async function getUserByUserId(userId: string) {
  const rows = await query("SELECT * FROM users WHERE userId = ?", [userId]);
  return rows[0] || null;
}
export async function getUserById(id: number) {
  const rows = await query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}
export async function createUser(data: { userId: string; passwordHash: string; displayName: string; email?: string; mobile?: string; role?: string; department?: string; permissions?: string[] }) {
  await run("INSERT OR IGNORE INTO users (userId,passwordHash,displayName,email,mobile,role,department,permissions) VALUES (?,?,?,?,?,?,?,?)",
    [data.userId, data.passwordHash, data.displayName, data.email||null, data.mobile||null, data.role||'user', data.department||null, JSON.stringify(data.permissions||[])]);
  return getUserByUserId(data.userId);
}
export async function getAllUsers() {
  return query("SELECT id,userId,displayName,email,mobile,role,department,status,createdAt,lastSignedIn FROM users ORDER BY createdAt DESC");
}
export async function updateUserLastSignIn(userId: string) {
  await run("UPDATE users SET lastSignedIn=datetime('now'),updatedAt=datetime('now') WHERE userId=?", [userId]);
}

// ─── Files ───────────────────────────────
export async function getFilesByUserId(userId: number) { return query("SELECT * FROM files WHERE userId=? ORDER BY updatedAt DESC", [userId]); }
export async function getFileById(id: number, userId: number) { return (await query("SELECT * FROM files WHERE id=? AND userId=?", [id, userId]))[0] || null; }
export async function createFile(data: { userId: number; title: string; type?: string; category?: string; status?: string; icon?: string; size?: string; filePath?: string; mimeType?: string; metadata?: any; tags?: string[] }) {
  await run("INSERT INTO files (userId,title,type,category,status,icon,size,filePath,mimeType,metadata,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [data.userId, data.title, data.type||'file', data.category||'general', data.status||'ready', data.icon||'description', data.size||null, data.filePath||null, data.mimeType||null, JSON.stringify(data.metadata||{}), JSON.stringify(data.tags||[])]);
  const id = await getLastId();
  return getFileById(id, data.userId);
}
export async function updateFile(id: number, userId: number, data: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k}=?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v); } }
  if (sets.length === 0) return;
  sets.push("updatedAt=datetime('now')"); vals.push(id, userId);
  await run(`UPDATE files SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}
export async function deleteFile(id: number, userId: number) { await run("DELETE FROM files WHERE id=? AND userId=?", [id, userId]); }
export async function toggleFavorite(id: number, userId: number) { await run("UPDATE files SET favorite=CASE WHEN favorite=1 THEN 0 ELSE 1 END WHERE id=? AND userId=?", [id, userId]); }

// ─── Reports ─────────────────────────────
export async function getReportsByUserId(userId: number) { return query("SELECT * FROM reports WHERE userId=? ORDER BY updatedAt DESC", [userId]); }
export async function getReportById(id: number, userId: number) { return (await query("SELECT * FROM reports WHERE id=? AND userId=?", [id, userId]))[0] || null; }
export async function createReport(data: { userId: number; title: string; description?: string; reportType?: string; sections?: any; classification?: string; entity?: string }) {
  await run("INSERT INTO reports (userId,title,description,reportType,sections,classification,entity) VALUES (?,?,?,?,?,?,?)",
    [data.userId, data.title, data.description||null, data.reportType||'general', typeof data.sections === 'string' ? data.sections : JSON.stringify(data.sections||[]), data.classification||'عام', data.entity||'']);
  const id = await getLastId();
  return getReportById(id, data.userId);
}
export async function updateReport(id: number, userId: number, data: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k}=?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v); } }
  if (sets.length === 0) return;
  sets.push("updatedAt=datetime('now')"); vals.push(id, userId);
  await run(`UPDATE reports SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}
export async function deleteReport(id: number, userId: number) { await run("DELETE FROM reports WHERE id=? AND userId=?", [id, userId]); }

// ─── Presentations ───────────────────────
export async function getPresentationsByUserId(userId: number) { return query("SELECT * FROM presentations WHERE userId=? ORDER BY updatedAt DESC", [userId]); }
export async function getPresentationById(id: number, userId: number) { return (await query("SELECT * FROM presentations WHERE id=? AND userId=?", [id, userId]))[0] || null; }
export async function createPresentation(data: { userId: number; title: string; description?: string; slides?: any; theme?: string }) {
  await run("INSERT INTO presentations (userId,title,description,slides,theme) VALUES (?,?,?,?,?)",
    [data.userId, data.title, data.description||null, typeof data.slides === 'string' ? data.slides : JSON.stringify(data.slides||[]), data.theme||'default']);
  const id = await getLastId();
  return getPresentationById(id, data.userId);
}
export async function updatePresentation(id: number, userId: number, data: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k}=?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v); } }
  if (sets.length === 0) return;
  sets.push("updatedAt=datetime('now')"); vals.push(id, userId);
  await run(`UPDATE presentations SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}
export async function deletePresentation(id: number, userId: number) { await run("DELETE FROM presentations WHERE id=? AND userId=?", [id, userId]); }

// ─── Dashboards ──────────────────────────
export async function getDashboardsByUserId(userId: number) { return query("SELECT * FROM dashboards WHERE userId=? ORDER BY updatedAt DESC", [userId]); }
export async function getDashboardById(id: number, userId: number) { return (await query("SELECT * FROM dashboards WHERE id=? AND userId=?", [id, userId]))[0] || null; }
export async function createDashboard(data: { userId: number; title: string; description?: string; widgets?: any; layout?: any }) {
  await run("INSERT INTO dashboards (userId,title,description,widgets,layout) VALUES (?,?,?,?,?)",
    [data.userId, data.title, data.description||null, typeof data.widgets === 'string' ? data.widgets : JSON.stringify(data.widgets||[]), typeof data.layout === 'string' ? data.layout : JSON.stringify(data.layout||{})]);
  const id = await getLastId();
  return getDashboardById(id, data.userId);
}
export async function updateDashboard(id: number, userId: number, data: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k}=?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v); } }
  if (sets.length === 0) return;
  sets.push("updatedAt=datetime('now')"); vals.push(id, userId);
  await run(`UPDATE dashboards SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}
export async function deleteDashboard(id: number, userId: number) { await run("DELETE FROM dashboards WHERE id=? AND userId=?", [id, userId]); }

// ─── Spreadsheets ────────────────────────
export async function getSpreadsheetsByUserId(userId: number) { return query("SELECT * FROM spreadsheets WHERE userId=? ORDER BY updatedAt DESC", [userId]); }
export async function getSpreadsheetById(id: number, userId: number) { return (await query("SELECT * FROM spreadsheets WHERE id=? AND userId=?", [id, userId]))[0] || null; }
export async function createSpreadsheet(data: { userId: number; title: string; description?: string; sheets?: any }) {
  await run("INSERT INTO spreadsheets (userId,title,description,sheets) VALUES (?,?,?,?)",
    [data.userId, data.title, data.description||null, typeof data.sheets === 'string' ? data.sheets : JSON.stringify(data.sheets||[])]);
  const id = await getLastId();
  return getSpreadsheetById(id, data.userId);
}
export async function updateSpreadsheet(id: number, userId: number, data: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k}=?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v); } }
  if (sets.length === 0) return;
  sets.push("updatedAt=datetime('now')"); vals.push(id, userId);
  await run(`UPDATE spreadsheets SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}
export async function deleteSpreadsheet(id: number, userId: number) { await run("DELETE FROM spreadsheets WHERE id=? AND userId=?", [id, userId]); }

// ─── Chat History ────────────────────────
export async function getChatHistory(userId: number, sessionId: string) { return query("SELECT * FROM chat_history WHERE userId=? AND sessionId=? ORDER BY createdAt ASC", [userId, sessionId]); }
export async function addChatMessage(data: { userId: number; sessionId: string; role: string; content: string; metadata?: any }) {
  await run("INSERT INTO chat_history (userId,sessionId,role,content,metadata) VALUES (?,?,?,?,?)",
    [data.userId, data.sessionId, data.role, data.content, JSON.stringify(data.metadata||{})]);
}

// ─── Extractions ─────────────────────────
export async function getExtractionsByUserId(userId: number) { return query("SELECT * FROM extractions WHERE userId=? ORDER BY createdAt DESC", [userId]); }
export async function createExtraction(data: { userId: number; sourceType: string; sourceFile?: string; extractedText?: string; structuredData?: any; language?: string }) {
  await run("INSERT INTO extractions (userId,sourceType,sourceFile,extractedText,structuredData,language) VALUES (?,?,?,?,?,?)",
    [data.userId, data.sourceType, data.sourceFile||null, data.extractedText||null, JSON.stringify(data.structuredData||{}), data.language||'ar']);
  const id = await getLastId();
  return (await query("SELECT * FROM extractions WHERE id=?", [id]))[0] || null;
}

// ─── Translations ────────────────────────
export async function getTranslationsByUserId(userId: number) { return query("SELECT * FROM translations WHERE userId=? ORDER BY createdAt DESC", [userId]); }
export async function createTranslation(data: { userId: number; sourceText: string; translatedText: string; sourceLang?: string; targetLang?: string; type?: string }) {
  await run("INSERT INTO translations (userId,sourceText,translatedText,sourceLang,targetLang,type) VALUES (?,?,?,?,?,?)",
    [data.userId, data.sourceText, data.translatedText, data.sourceLang||'ar', data.targetLang||'en', data.type||'translation']);
  const id = await getLastId();
  return (await query("SELECT * FROM translations WHERE id=?", [id]))[0] || null;
}

// ─── Library (aggregated) ────────────────
export async function getLibraryItems(userId: number) {
  const items: any[] = [];
  (await query("SELECT id,title,type,category,status,icon,size,favorite,createdAt,updatedAt FROM files WHERE userId=? ORDER BY updatedAt DESC", [userId]))
    .forEach(r => items.push({ ...r, source: 'files' }));
  (await query("SELECT id,title,reportType as type,status,createdAt,updatedAt FROM reports WHERE userId=? ORDER BY updatedAt DESC", [userId]))
    .forEach(r => items.push({ ...r, source: 'reports', icon: 'description', category: 'report' }));
  (await query("SELECT id,title,status,createdAt,updatedAt FROM presentations WHERE userId=? ORDER BY updatedAt DESC", [userId]))
    .forEach(r => items.push({ ...r, source: 'presentations', icon: 'slideshow', category: 'presentation', type: 'presentation' }));
  (await query("SELECT id,title,status,createdAt,updatedAt FROM dashboards WHERE userId=? ORDER BY updatedAt DESC", [userId]))
    .forEach(r => items.push({ ...r, source: 'dashboards', icon: 'dashboard', category: 'dashboard', type: 'dashboard' }));
  (await query("SELECT id,title,status,createdAt,updatedAt FROM spreadsheets WHERE userId=? ORDER BY updatedAt DESC", [userId]))
    .forEach(r => items.push({ ...r, source: 'spreadsheets', icon: 'table_chart', category: 'spreadsheet', type: 'spreadsheet' }));
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items;
}

// ─── Shared Presentations ────────────────
export async function createSharedPresentation(data: { presentationId: number; userId: number; title: string; slides: string; theme: string; brandKit: string; password?: string }) {
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await run("INSERT INTO shared_presentations (presentationId,userId,shareToken,password,title,slides,theme,brandKit) VALUES (?,?,?,?,?,?,?,?)",
    [data.presentationId, data.userId, token, data.password||null, data.title, data.slides, data.theme, data.brandKit]);
  return (await query("SELECT * FROM shared_presentations WHERE shareToken=?", [token]))[0];
}
export async function getSharedPresentation(shareToken: string) {
  const rows = await query("SELECT * FROM shared_presentations WHERE shareToken=? AND isPublic=1", [shareToken]);
  if (rows.length === 0) return null;
  await run("UPDATE shared_presentations SET viewCount=viewCount+1 WHERE shareToken=?", [shareToken]);
  return rows[0];
}
export async function getMySharedPresentations(userId: number) { return query("SELECT * FROM shared_presentations WHERE userId=? ORDER BY createdAt DESC", [userId]); }
export async function deleteSharedPresentation(id: number, userId: number) { await run("DELETE FROM shared_presentations WHERE id=? AND userId=?", [id, userId]); }
export async function updateSharedPresentation(id: number, userId: number, data: { isPublic?: number; password?: string | null }) {
  const sets: string[] = []; const vals: any[] = [];
  if (data.isPublic !== undefined) { sets.push("isPublic=?"); vals.push(data.isPublic); }
  if (data.password !== undefined) { sets.push("password=?"); vals.push(data.password); }
  if (sets.length === 0) return;
  vals.push(id, userId);
  await run(`UPDATE shared_presentations SET ${sets.join(',')} WHERE id=? AND userId=?`, vals);
}

// ─── Admin Stats ─────────────────────────
export async function getAdminStats() {
  const d = await getDb();
  const cnt = (sql: string) => { const r = d.exec(sql); return Number(toObjects(r)[0]?.count || 0); };
  return {
    users: cnt("SELECT COUNT(*) as count FROM users"),
    files: cnt("SELECT COUNT(*) as count FROM files"),
    reports: cnt("SELECT COUNT(*) as count FROM reports"),
    presentations: cnt("SELECT COUNT(*) as count FROM presentations"),
    dashboards: cnt("SELECT COUNT(*) as count FROM dashboards"),
    spreadsheets: cnt("SELECT COUNT(*) as count FROM spreadsheets"),
    translations: cnt("SELECT COUNT(*) as count FROM translations"),
    extractions: cnt("SELECT COUNT(*) as count FROM extractions"),
    totalContent: 0,
  };
}

// ─── Seed Admin ──────────────────────────
export async function seedAdminAccount() {
  const existing = await getUserByUserId("mruhaily");
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("15001500", 12);
  const perms = JSON.stringify(["manage_users","manage_content","manage_roles","view_analytics","manage_settings","manage_data","create_reports","approve_content","manage_system","full_access"]);
  if (existing) {
    await run("UPDATE users SET passwordHash=?,role='admin',status='active',permissions=?,updatedAt=datetime('now') WHERE userId='mruhaily'", [hash, perms]);
  } else {
    await run("INSERT INTO users (userId,passwordHash,displayName,email,mobile,role,department,status,permissions) VALUES (?,?,?,?,?,?,?,?,?)",
      ["mruhaily", hash, "محمد الرحيلي — عقل راصد الذكي", "prog.muhammed@gmail.com", "+966553445533", "admin", "إدارة المنصة", "active", perms]);
  }
  console.log("[Seed] Admin account ready: mruhaily");
}
