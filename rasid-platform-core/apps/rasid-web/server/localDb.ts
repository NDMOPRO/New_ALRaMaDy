/**
 * Local SQLite Database — fully independent, no external services
 * Uses sql.js (pure JS SQLite) for zero-dependency operation
 */
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "rasid.db");

let db: SqlJsDatabase | null = null;

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Convert sql.js exec result to array of objects */
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
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create all tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      displayName TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      department TEXT,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      lastSignedIn TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'file',
      category TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'ready',
      icon TEXT DEFAULT 'description',
      size TEXT,
      filePath TEXT,
      mimeType TEXT,
      metadata TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      favorite INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      reportType TEXT DEFAULT 'general',
      sections TEXT DEFAULT '[]',
      classification TEXT DEFAULT 'عام',
      entity TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      slides TEXT DEFAULT '[]',
      theme TEXT DEFAULT 'default',
      status TEXT NOT NULL DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      widgets TEXT DEFAULT '[]',
      layout TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS spreadsheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      sheets TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      sourceText TEXT NOT NULL,
      translatedText TEXT NOT NULL,
      sourceLang TEXT DEFAULT 'ar',
      targetLang TEXT DEFAULT 'en',
      type TEXT DEFAULT 'translation',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      sourceType TEXT NOT NULL,
      sourceFile TEXT,
      extractedText TEXT,
      structuredData TEXT DEFAULT '{}',
      language TEXT DEFAULT 'ar',
      status TEXT NOT NULL DEFAULT 'completed',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS shared_presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentationId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      shareToken TEXT NOT NULL UNIQUE,
      password TEXT,
      title TEXT NOT NULL,
      slides TEXT DEFAULT '[]',
      theme TEXT DEFAULT 'default',
      brandKit TEXT DEFAULT '{}',
      isPublic INTEGER NOT NULL DEFAULT 1,
      viewCount INTEGER NOT NULL DEFAULT 0,
      expiresAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (presentationId) REFERENCES presentations(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  ensureDir();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ─── User Queries ─────────────────────────────────────────────────
export async function getUserByUserId(userId: string) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM users WHERE userId = ?", [userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getUserById(id: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM users WHERE id = ?", [id]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function createUser(data: {
  userId: string;
  passwordHash: string;
  displayName: string;
  email?: string;
  mobile?: string;
  role?: string;
  department?: string;
  permissions?: string[];
}) {
  const database = await getDb();
  database.run(
    `INSERT OR IGNORE INTO users (userId, passwordHash, displayName, email, mobile, role, department, permissions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.passwordHash,
      data.displayName,
      data.email || null,
      data.mobile || null,
      data.role || "user",
      data.department || null,
      JSON.stringify(data.permissions || []),
    ]
  );
  saveDb();
  return getUserByUserId(data.userId);
}

export async function getAllUsers() {
  const database = await getDb();
  const results = database.exec("SELECT id, userId, displayName, email, mobile, role, department, status, createdAt, lastSignedIn FROM users ORDER BY createdAt DESC");
  return toObjects(results);
}

export async function updateUserLastSignIn(userId: string) {
  const database = await getDb();
  database.run("UPDATE users SET lastSignedIn = datetime('now'), updatedAt = datetime('now') WHERE userId = ?", [userId]);
  saveDb();
}

// ─── Files Queries ────────────────────────────────────────────────
export async function getFilesByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM files WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  return toObjects(results);
}

export async function createFile(data: {
  userId: number;
  title: string;
  type?: string;
  category?: string;
  status?: string;
  icon?: string;
  size?: string;
  filePath?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO files (userId, title, type, category, status, icon, size, filePath, mimeType, metadata, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId, data.title, data.type || "file", data.category || "general",
      data.status || "ready", data.icon || "description", data.size || null,
      data.filePath || null, data.mimeType || null,
      JSON.stringify(data.metadata || {}), JSON.stringify(data.tags || []),
    ]
  );
  saveDb();
  const results = database.exec("SELECT * FROM files WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function deleteFile(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM files WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

export async function toggleFavorite(id: number, userId: number) {
  const database = await getDb();
  database.run("UPDATE files SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

// ─── Reports Queries ──────────────────────────────────────────────
export async function getReportsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM reports WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  return toObjects(results);
}

export async function createReport(data: {
  userId: number; title: string; description?: string;
  reportType?: string; sections?: any[]; classification?: string; entity?: string;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO reports (userId, title, description, reportType, sections, classification, entity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, data.title, data.description || null, data.reportType || "general",
     JSON.stringify(data.sections || []), data.classification || "عام", data.entity || ""]
  );
  saveDb();
  const results = database.exec("SELECT * FROM reports WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function updateReport(id: number, userId: number, data: { title?: string; sections?: any[]; classification?: string; entity?: string; status?: string }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
  if (data.sections !== undefined) { sets.push("sections = ?"); vals.push(JSON.stringify(data.sections)); }
  if (data.classification !== undefined) { sets.push("classification = ?"); vals.push(data.classification); }
  if (data.entity !== undefined) { sets.push("entity = ?"); vals.push(data.entity); }
  if (data.status !== undefined) { sets.push("status = ?"); vals.push(data.status); }
  if (sets.length === 0) return;
  sets.push("updatedAt = datetime('now')");
  vals.push(id, userId);
  database.run(`UPDATE reports SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

export async function deleteReport(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM reports WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

// ─── Presentations Queries ────────────────────────────────────────
export async function getPresentationsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM presentations WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  return toObjects(results);
}

export async function createPresentation(data: {
  userId: number; title: string; description?: string; slides?: any[]; theme?: string;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO presentations (userId, title, description, slides, theme) VALUES (?, ?, ?, ?, ?)`,
    [data.userId, data.title, data.description || null, JSON.stringify(data.slides || []), data.theme || "default"]
  );
  saveDb();
  const results = database.exec("SELECT * FROM presentations WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function updatePresentation(id: number, userId: number, data: { title?: string; slides?: any[]; theme?: string; status?: string }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
  if (data.slides !== undefined) { sets.push("slides = ?"); vals.push(JSON.stringify(data.slides)); }
  if (data.theme !== undefined) { sets.push("theme = ?"); vals.push(data.theme); }
  if (data.status !== undefined) { sets.push("status = ?"); vals.push(data.status); }
  if (sets.length === 0) return;
  sets.push("updatedAt = datetime('now')");
  vals.push(id, userId);
  database.run(`UPDATE presentations SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

// ─── Dashboards Queries ───────────────────────────────────────────
export async function getDashboardsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM dashboards WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  return toObjects(results);
}

export async function createDashboard(data: {
  userId: number; title: string; description?: string; widgets?: any[]; layout?: Record<string, any>;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO dashboards (userId, title, description, widgets, layout) VALUES (?, ?, ?, ?, ?)`,
    [data.userId, data.title, data.description || null, JSON.stringify(data.widgets || []), JSON.stringify(data.layout || {})]
  );
  saveDb();
  const results = database.exec("SELECT * FROM dashboards WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

// ─── Spreadsheets Queries ─────────────────────────────────────────
export async function getSpreadsheetsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM spreadsheets WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  return toObjects(results);
}

export async function createSpreadsheet(data: {
  userId: number; title: string; description?: string; sheets?: any[];
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO spreadsheets (userId, title, description, sheets) VALUES (?, ?, ?, ?)`,
    [data.userId, data.title, data.description || null, JSON.stringify(data.sheets || [])]
  );
  saveDb();
  const results = database.exec("SELECT * FROM spreadsheets WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

// ─── Chat History Queries ─────────────────────────────────────────
export async function getChatHistory(userId: number, sessionId: string) {
  const database = await getDb();
  const results = database.exec(
    "SELECT * FROM chat_history WHERE userId = ? AND sessionId = ? ORDER BY createdAt ASC",
    [userId, sessionId]
  );
  return toObjects(results);
}

export async function addChatMessage(data: {
  userId: number; sessionId: string; role: string; content: string; metadata?: Record<string, any>;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO chat_history (userId, sessionId, role, content, metadata) VALUES (?, ?, ?, ?, ?)`,
    [data.userId, data.sessionId, data.role, data.content, JSON.stringify(data.metadata || {})]
  );
  saveDb();
}

// ─── Library (aggregated view) ────────────────────────────────────
export async function getLibraryItems(userId: number) {
  const database = await getDb();
  const items: Record<string, any>[] = [];

  const files = database.exec("SELECT id, title, type, category, status, icon, size, favorite, createdAt, updatedAt FROM files WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  toObjects(files).forEach((obj) => { items.push({ ...obj, source: "files" }); });

  const reports = database.exec("SELECT id, title, reportType as type, status, createdAt, updatedAt FROM reports WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  toObjects(reports).forEach((obj) => { items.push({ ...obj, source: "reports", icon: "description", category: "report" }); });

  const presentations = database.exec("SELECT id, title, status, createdAt, updatedAt FROM presentations WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  toObjects(presentations).forEach((obj) => { items.push({ ...obj, source: "presentations", icon: "slideshow", category: "presentation", type: "presentation" }); });

  const dashboards = database.exec("SELECT id, title, status, createdAt, updatedAt FROM dashboards WHERE userId = ? ORDER BY updatedAt DESC", [userId]);
  toObjects(dashboards).forEach((obj) => { items.push({ ...obj, source: "dashboards", icon: "dashboard", category: "dashboard", type: "dashboard" }); });

  items.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());
  return items;
}

// ─── Extractions Queries ─────────────────────────────────────────
export async function getExtractionsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM extractions WHERE userId = ? ORDER BY createdAt DESC", [userId]);
  return toObjects(results);
}

export async function createExtraction(data: {
  userId: number; sourceType: string; sourceFile?: string;
  extractedText?: string; structuredData?: Record<string, any>; language?: string;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO extractions (userId, sourceType, sourceFile, extractedText, structuredData, language)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userId, data.sourceType, data.sourceFile || null,
     data.extractedText || null, JSON.stringify(data.structuredData || {}), data.language || "ar"]
  );
  saveDb();
  const results = database.exec("SELECT * FROM extractions WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

// ─── Translations Queries ────────────────────────────────────────
export async function getTranslationsByUserId(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM translations WHERE userId = ? ORDER BY createdAt DESC", [userId]);
  return toObjects(results);
}

export async function createTranslation(data: {
  userId: number; sourceText: string; translatedText: string;
  sourceLang?: string; targetLang?: string; type?: string;
}) {
  const database = await getDb();
  database.run(
    `INSERT INTO translations (userId, sourceText, translatedText, sourceLang, targetLang, type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userId, data.sourceText, data.translatedText,
     data.sourceLang || "ar", data.targetLang || "en", data.type || "translation"]
  );
  saveDb();
  const results = database.exec("SELECT * FROM translations WHERE userId = ? ORDER BY id DESC LIMIT 1", [data.userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

// ─── Dashboard Update ────────────────────────────────────────────
export async function updateDashboard(id: number, userId: number, data: { title?: string; widgets?: any[]; layout?: Record<string, any>; status?: string }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
  if (data.widgets !== undefined) { sets.push("widgets = ?"); vals.push(JSON.stringify(data.widgets)); }
  if (data.layout !== undefined) { sets.push("layout = ?"); vals.push(JSON.stringify(data.layout)); }
  if (data.status !== undefined) { sets.push("status = ?"); vals.push(data.status); }
  if (sets.length === 0) return;
  sets.push("updatedAt = datetime('now')");
  vals.push(id, userId);
  database.run(`UPDATE dashboards SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

export async function deleteDashboard(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM dashboards WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

// ─── Spreadsheet Update ──────────────────────────────────────────
export async function updateSpreadsheet(id: number, userId: number, data: { title?: string; sheets?: any[]; status?: string }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
  if (data.sheets !== undefined) { sets.push("sheets = ?"); vals.push(JSON.stringify(data.sheets)); }
  if (data.status !== undefined) { sets.push("status = ?"); vals.push(data.status); }
  if (sets.length === 0) return;
  sets.push("updatedAt = datetime('now')");
  vals.push(id, userId);
  database.run(`UPDATE spreadsheets SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

export async function deleteSpreadsheet(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM spreadsheets WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

// ─── File Update ─────────────────────────────────────────────────
export async function updateFile(id: number, userId: number, data: { title?: string; status?: string; metadata?: Record<string, any>; tags?: string[] }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
  if (data.status !== undefined) { sets.push("status = ?"); vals.push(data.status); }
  if (data.metadata !== undefined) { sets.push("metadata = ?"); vals.push(JSON.stringify(data.metadata)); }
  if (data.tags !== undefined) { sets.push("tags = ?"); vals.push(JSON.stringify(data.tags)); }
  if (sets.length === 0) return;
  sets.push("updatedAt = datetime('now')");
  vals.push(id, userId);
  database.run(`UPDATE files SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

// ─── Get single items by ID ─────────────────────────────────────
export async function getFileById(id: number, userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM files WHERE id = ? AND userId = ?", [id, userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getReportById(id: number, userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM reports WHERE id = ? AND userId = ?", [id, userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getPresentationById(id: number, userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM presentations WHERE id = ? AND userId = ?", [id, userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getDashboardById(id: number, userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM dashboards WHERE id = ? AND userId = ?", [id, userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getSpreadsheetById(id: number, userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM spreadsheets WHERE id = ? AND userId = ?", [id, userId]);
  const rows = toObjects(results);
  return rows.length > 0 ? rows[0]! : null;
}

export async function deletePresentation(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM presentations WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

// ─── Shared Presentations ──────────────────────────────────

export async function createSharedPresentation(data: {
  presentationId: number;
  userId: number;
  title: string;
  slides: string;
  theme: string;
  brandKit: string;
  password?: string;
  expiresAt?: string;
}) {
  const database = await getDb();
  const shareToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  database.run(
    `INSERT INTO shared_presentations (presentationId, userId, shareToken, password, title, slides, theme, brandKit, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.presentationId, data.userId, shareToken, data.password || null, data.title, data.slides, data.theme, data.brandKit, data.expiresAt || null]
  );
  saveDb();
  const results = database.exec("SELECT * FROM shared_presentations WHERE shareToken = ?", [shareToken]);
  const rows = toObjects(results);
  return rows[0]!;
}

export async function getSharedPresentation(shareToken: string) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM shared_presentations WHERE shareToken = ? AND isPublic = 1", [shareToken]);
  const rows = toObjects(results);
  if (rows.length === 0) return null;
  // Increment view count
  database.run("UPDATE shared_presentations SET viewCount = viewCount + 1 WHERE shareToken = ?", [shareToken]);
  saveDb();
  return rows[0]!;
}

export async function getMySharedPresentations(userId: number) {
  const database = await getDb();
  const results = database.exec("SELECT * FROM shared_presentations WHERE userId = ? ORDER BY createdAt DESC", [userId]);
  return toObjects(results);
}

export async function deleteSharedPresentation(id: number, userId: number) {
  const database = await getDb();
  database.run("DELETE FROM shared_presentations WHERE id = ? AND userId = ?", [id, userId]);
  saveDb();
}

export async function updateSharedPresentation(id: number, userId: number, data: { isPublic?: number; password?: string | null }) {
  const database = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.isPublic !== undefined) { sets.push("isPublic = ?"); vals.push(data.isPublic); }
  if (data.password !== undefined) { sets.push("password = ?"); vals.push(data.password); }
  if (sets.length === 0) return;
  vals.push(id, userId);
  database.run(`UPDATE shared_presentations SET ${sets.join(", ")} WHERE id = ? AND userId = ?`, vals);
  saveDb();
}

// ─── Admin Stats & Activity ──────────────────────────────────

export async function getAdminStats() {
  const database = await getDb();
  const userCount = toObjects(database.exec("SELECT COUNT(*) as count FROM users"))[0]?.count || 0;
  const fileCount = toObjects(database.exec("SELECT COUNT(*) as count FROM files"))[0]?.count || 0;
  const reportCount = toObjects(database.exec("SELECT COUNT(*) as count FROM reports"))[0]?.count || 0;
  const presentationCount = toObjects(database.exec("SELECT COUNT(*) as count FROM presentations"))[0]?.count || 0;
  const dashboardCount = toObjects(database.exec("SELECT COUNT(*) as count FROM dashboards"))[0]?.count || 0;
  const spreadsheetCount = toObjects(database.exec("SELECT COUNT(*) as count FROM spreadsheets"))[0]?.count || 0;
  const translationCount = toObjects(database.exec("SELECT COUNT(*) as count FROM translations"))[0]?.count || 0;
  const extractionCount = toObjects(database.exec("SELECT COUNT(*) as count FROM extractions"))[0]?.count || 0;
  return {
    users: Number(userCount),
    files: Number(fileCount),
    reports: Number(reportCount),
    presentations: Number(presentationCount),
    dashboards: Number(dashboardCount),
    spreadsheets: Number(spreadsheetCount),
    translations: Number(translationCount),
    extractions: Number(extractionCount),
    totalContent: Number(fileCount) + Number(reportCount) + Number(presentationCount) + Number(dashboardCount) + Number(spreadsheetCount),
  };
}

export async function getRecentActivity(limit = 20) {
  const database = await getDb();
  // Combine recent items from all tables
  const activities: { text: string; time: string; icon: string; type: string }[] = [];
  
  const recentFiles = toObjects(database.exec(`SELECT f.title, f.createdAt, u.name as userName FROM files f LEFT JOIN users u ON f.userId = u.id ORDER BY f.createdAt DESC LIMIT 5`));
  for (const f of recentFiles) {
    activities.push({ text: `${f.userName || 'مستخدم'} رفع ملف: ${f.title}`, time: f.createdAt as string, icon: 'upload_file', type: 'upload' });
  }
  
  const recentReports = toObjects(database.exec(`SELECT r.title, r.createdAt, u.name as userName FROM reports r LEFT JOIN users u ON r.userId = u.id ORDER BY r.createdAt DESC LIMIT 5`));
  for (const r of recentReports) {
    activities.push({ text: `${r.userName || 'مستخدم'} أنشأ تقرير: ${r.title}`, time: r.createdAt as string, icon: 'description', type: 'create' });
  }
  
  const recentPresentations = toObjects(database.exec(`SELECT p.title, p.createdAt, u.name as userName FROM presentations p LEFT JOIN users u ON p.userId = u.id ORDER BY p.createdAt DESC LIMIT 5`));
  for (const p of recentPresentations) {
    activities.push({ text: `${p.userName || 'مستخدم'} أنشأ عرض: ${p.title}`, time: p.createdAt as string, icon: 'slideshow', type: 'create' });
  }
  
  const recentUsers = toObjects(database.exec(`SELECT name, createdAt FROM users ORDER BY createdAt DESC LIMIT 5`));
  for (const u of recentUsers) {
    activities.push({ text: `${u.name || 'مستخدم جديد'} انضم للمنصة`, time: u.createdAt as string, icon: 'person_add', type: 'login' });
  }
  
  // Sort by time descending
  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return activities.slice(0, limit);
}

export async function getAllContent() {
  const database = await getDb();
  const content: { id: number; title: string; type: string; status: string; createdAt: string; userName: string }[] = [];
  
  const files = toObjects(database.exec(`SELECT f.id, f.title, f.status, f.createdAt, u.name as userName FROM files f LEFT JOIN users u ON f.userId = u.id ORDER BY f.createdAt DESC`));
  for (const f of files) {
    content.push({ id: f.id as number, title: f.title as string, type: 'file', status: (f.status as string) || 'draft', createdAt: f.createdAt as string, userName: (f.userName as string) || 'مستخدم' });
  }
  
  const reports = toObjects(database.exec(`SELECT r.id, r.title, r.status, r.createdAt, u.name as userName FROM reports r LEFT JOIN users u ON r.userId = u.id ORDER BY r.createdAt DESC`));
  for (const r of reports) {
    content.push({ id: r.id as number, title: r.title as string, type: 'report', status: (r.status as string) || 'draft', createdAt: r.createdAt as string, userName: (r.userName as string) || 'مستخدم' });
  }
  
  const presentations = toObjects(database.exec(`SELECT p.id, p.title, p.status, p.createdAt, u.name as userName FROM presentations p LEFT JOIN users u ON p.userId = u.id ORDER BY p.createdAt DESC`));
  for (const p of presentations) {
    content.push({ id: p.id as number, title: p.title as string, type: 'presentation', status: (p.status as string) || 'draft', createdAt: p.createdAt as string, userName: (p.userName as string) || 'مستخدم' });
  }
  
  content.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return content;
}
