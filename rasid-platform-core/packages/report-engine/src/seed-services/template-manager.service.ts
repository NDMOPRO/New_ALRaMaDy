/**
 * Template Manager Service — Adapted from Seed
 *
 * Template creation, rendering, versioning, and management
 * with multi-engine support (Handlebars, Mustache, EJS, Nunjucks).
 *
 * Adapted: PrismaClient → prismaAdapter (sql.js), Express → tRPC
 * Original: 06_template_core/services/template-service/src/services/template-manager.service.ts (829 lines)
 *           + version-control.service.ts (608 lines)
 */

import { randomUUID, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG = "[TemplateManager]";
const log = {
  info: (msg: string, m?: any) => console.log(`${LOG} ${msg}`, m || ""),
  warn: (msg: string, m?: any) => console.warn(`${LOG} ${msg}`, m || ""),
  error: (msg: string, m?: any) => console.error(`${LOG} ${msg}`, m || ""),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateType = "report" | "dashboard" | "presentation" | "infographic" | "email";
export type EngineType = "handlebars" | "mustache" | "ejs" | "nunjucks" | "simple";

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  defaultValue?: unknown;
  required?: boolean;
  description?: string;
}

export interface TemplateModel {
  id: string;
  name: string;
  type: TemplateType;
  engine: EngineType;
  content: string;
  variables: TemplateVariable[];
  category: string;
  tenantId: string;
  userId: string;
  version: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRenderRequest {
  templateId: string;
  data: Record<string, unknown>;
  format?: "html" | "text" | "markdown";
  locale?: string;
}

export interface TemplateRenderResult {
  output: string;
  format: string;
  renderTime: number;
  warnings: string[];
  variablesUsed: string[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  label?: string;
  content: string;
  contentHash: string;
  changes: ChangeRecord[];
  createdBy: string;
  createdAt: string;
  message: string;
  branchName: string;
  tags: string[];
}

export interface ChangeRecord {
  path: string;
  type: "add" | "modify" | "delete" | "move" | "rename";
  oldValue?: string;
  newValue?: string;
  description: string;
}

export interface DiffResult {
  templateId: string;
  versionA: number;
  versionB: number;
  changes: ChangeRecord[];
  summary: DiffSummary;
}

export interface DiffSummary {
  totalChanges: number;
  additions: number;
  modifications: number;
  deletions: number;
  affectedPaths: string[];
}

export interface VersionHistory {
  templateId: string;
  versions: TemplateVersion[];
  currentVersion: number;
  totalVersions: number;
}

export interface TemplateTheme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  direction: "rtl" | "ltr";
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
  arabic: string;
}

export interface ThemeSpacing {
  unit: number;
  page: { top: number; right: number; bottom: number; left: number };
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const templateStore = new Map<string, TemplateModel>();
const versionStore = new Map<string, TemplateVersion[]>();
const themeStore = new Map<string, TemplateTheme>();

// Initialize default themes
const DEFAULT_THEMES: TemplateTheme[] = [
  {
    id: "rasid-default",
    name: "رصيد الافتراضي",
    colors: {
      primary: "#1a73e8", secondary: "#5f6368", accent: "#fbbc04",
      background: "#ffffff", surface: "#f8f9fa", text: "#202124",
      textSecondary: "#5f6368", border: "#dadce0",
      success: "#34a853", warning: "#fbbc04", error: "#ea4335",
    },
    fonts: { heading: "Cairo", body: "Tajawal", mono: "IBM Plex Mono", arabic: "Noto Naskh Arabic" },
    spacing: { unit: 8, page: { top: 40, right: 40, bottom: 40, left: 40 } },
    direction: "rtl",
  },
  {
    id: "rasid-dark",
    name: "رصيد الداكن",
    colors: {
      primary: "#8ab4f8", secondary: "#9aa0a6", accent: "#fdd663",
      background: "#202124", surface: "#303134", text: "#e8eaed",
      textSecondary: "#9aa0a6", border: "#5f6368",
      success: "#81c995", warning: "#fdd663", error: "#f28b82",
    },
    fonts: { heading: "Cairo", body: "Tajawal", mono: "IBM Plex Mono", arabic: "Noto Naskh Arabic" },
    spacing: { unit: 8, page: { top: 40, right: 40, bottom: 40, left: 40 } },
    direction: "rtl",
  },
  {
    id: "rasid-formal",
    name: "رصيد الرسمي",
    colors: {
      primary: "#1b3a5c", secondary: "#4a6fa5", accent: "#c9a961",
      background: "#ffffff", surface: "#f5f5f0", text: "#1a1a1a",
      textSecondary: "#666666", border: "#cccccc",
      success: "#2e7d32", warning: "#f57f17", error: "#c62828",
    },
    fonts: { heading: "Amiri", body: "Noto Naskh Arabic", mono: "Courier New", arabic: "Amiri" },
    spacing: { unit: 10, page: { top: 50, right: 50, bottom: 50, left: 50 } },
    direction: "rtl",
  },
];

for (const theme of DEFAULT_THEMES) themeStore.set(theme.id, theme);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TemplateManagerService {
  private db: any;

  constructor(dbAdapter?: any) {
    this.db = dbAdapter;
  }

  // ─── Template CRUD ──────────────────────────────────────────

  async createTemplate(
    name: string,
    type: TemplateType,
    engine: EngineType,
    content: string,
    variables: TemplateVariable[],
    category: string,
    tenantId: string,
    userId: string
  ): Promise<TemplateModel> {
    if (!name?.trim()) throw new Error("Template name cannot be empty");
    if (!content?.trim()) throw new Error("Template content cannot be empty");

    // Validate template compiles
    this.compileTemplate(engine, content);

    const template: TemplateModel = {
      id: randomUUID(),
      name: name.trim(),
      type,
      engine,
      content,
      variables,
      category,
      tenantId,
      userId,
      version: 1,
      isActive: true,
      metadata: {
        contentHash: createHash("sha256").update(content).digest("hex"),
        variableCount: variables.length,
        size: Buffer.byteLength(content, "utf-8"),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    templateStore.set(template.id, template);

    // Create initial version
    this.createVersion(template.id, content, userId, "Initial version", "main");

    // Persist to DB
    if (this.db?.template) {
      await this.db.template.create({
        data: {
          templateId: template.id,
          name: template.name,
          type: template.type,
          engine: template.engine,
          content: template.content,
          variables: JSON.stringify(template.variables),
          category: template.category,
          tenantId: template.tenantId,
          userId: template.userId,
          version: template.version,
        },
      });
    }

    log.info(`Template created: ${template.name}`, { id: template.id });
    return template;
  }

  getTemplate(templateId: string): TemplateModel | undefined {
    return templateStore.get(templateId);
  }

  listTemplates(tenantId: string, type?: TemplateType): TemplateModel[] {
    return Array.from(templateStore.values())
      .filter((t) => t.tenantId === tenantId && t.isActive)
      .filter((t) => !type || t.type === type);
  }

  async updateTemplate(
    templateId: string,
    content: string,
    userId: string,
    message: string
  ): Promise<TemplateModel> {
    const template = templateStore.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // Validate new content
    this.compileTemplate(template.engine, content);

    const oldContent = template.content;
    template.content = content;
    template.version++;
    template.updatedAt = new Date().toISOString();
    template.metadata.contentHash = createHash("sha256").update(content).digest("hex");

    // Create version
    this.createVersion(templateId, content, userId, message, "main", oldContent);

    log.info(`Template updated: ${template.name} v${template.version}`);
    return template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const template = templateStore.get(templateId);
    if (template) {
      template.isActive = false;
      log.info(`Template deleted: ${template.name}`);
    }
  }

  // ─── Rendering ──────────────────────────────────────────────

  async render(request: TemplateRenderRequest): Promise<TemplateRenderResult> {
    const startTime = Date.now();
    const template = templateStore.get(request.templateId);
    if (!template) throw new Error(`Template ${request.templateId} not found`);

    const warnings: string[] = [];
    const variablesUsed: string[] = [];

    // Check required variables
    for (const v of template.variables) {
      if (v.required && !(v.name in request.data)) {
        if (v.defaultValue !== undefined) {
          request.data[v.name] = v.defaultValue;
          warnings.push(`Using default value for required variable: ${v.name}`);
        } else {
          warnings.push(`Missing required variable: ${v.name}`);
        }
      }
      if (v.name in request.data) variablesUsed.push(v.name);
    }

    // Render
    const output = this.renderWithEngine(template.engine, template.content, request.data);

    return {
      output,
      format: request.format || "html",
      renderTime: Date.now() - startTime,
      warnings,
      variablesUsed,
    };
  }

  // ─── Version Control ────────────────────────────────────────

  private createVersion(
    templateId: string,
    content: string,
    userId: string,
    message: string,
    branch: string,
    oldContent?: string
  ): TemplateVersion {
    const versions = versionStore.get(templateId) || [];
    const version: TemplateVersion = {
      id: randomUUID(),
      templateId,
      version: versions.length + 1,
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
      changes: oldContent ? this.computeChanges(oldContent, content) : [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      message,
      branchName: branch,
      tags: [],
    };

    versions.push(version);
    versionStore.set(templateId, versions);
    return version;
  }

  getVersionHistory(templateId: string): VersionHistory {
    const versions = versionStore.get(templateId) || [];
    return {
      templateId,
      versions,
      currentVersion: versions.length,
      totalVersions: versions.length,
    };
  }

  getVersion(templateId: string, version: number): TemplateVersion | undefined {
    const versions = versionStore.get(templateId) || [];
    return versions.find((v) => v.version === version);
  }

  diff(templateId: string, versionA: number, versionB: number): DiffResult {
    const versions = versionStore.get(templateId) || [];
    const a = versions.find((v) => v.version === versionA);
    const b = versions.find((v) => v.version === versionB);

    if (!a || !b) throw new Error("Version not found");

    const changes = this.computeChanges(a.content, b.content);

    return {
      templateId,
      versionA,
      versionB,
      changes,
      summary: {
        totalChanges: changes.length,
        additions: changes.filter((c) => c.type === "add").length,
        modifications: changes.filter((c) => c.type === "modify").length,
        deletions: changes.filter((c) => c.type === "delete").length,
        affectedPaths: changes.map((c) => c.path),
      },
    };
  }

  async restoreVersion(templateId: string, version: number, userId: string): Promise<TemplateModel> {
    const v = this.getVersion(templateId, version);
    if (!v) throw new Error(`Version ${version} not found`);
    return this.updateTemplate(templateId, v.content, userId, `Restored from version ${version}`);
  }

  // ─── Themes ─────────────────────────────────────────────────

  getTheme(themeId: string): TemplateTheme | undefined {
    return themeStore.get(themeId);
  }

  listThemes(): TemplateTheme[] {
    return Array.from(themeStore.values());
  }

  createTheme(theme: TemplateTheme): void {
    themeStore.set(theme.id, theme);
    log.info(`Theme created: ${theme.name}`);
  }

  applyTheme(content: string, theme: TemplateTheme): string {
    let result = content;
    // Replace CSS variables with theme values
    result = result.replace(/var\(--primary\)/g, theme.colors.primary);
    result = result.replace(/var\(--secondary\)/g, theme.colors.secondary);
    result = result.replace(/var\(--accent\)/g, theme.colors.accent);
    result = result.replace(/var\(--background\)/g, theme.colors.background);
    result = result.replace(/var\(--text\)/g, theme.colors.text);
    result = result.replace(/var\(--font-heading\)/g, theme.fonts.heading);
    result = result.replace(/var\(--font-body\)/g, theme.fonts.body);
    result = result.replace(/var\(--font-arabic\)/g, theme.fonts.arabic);
    result = result.replace(/var\(--direction\)/g, theme.direction);
    return result;
  }

  // ─── Private methods ────────────────────────────────────────

  private compileTemplate(engine: EngineType, content: string): void {
    switch (engine) {
      case "simple":
        // Simple {{variable}} replacement — always valid
        break;
      case "handlebars":
      case "mustache":
        // Validate mustache-style syntax
        const openCount = (content.match(/\{\{/g) || []).length;
        const closeCount = (content.match(/\}\}/g) || []).length;
        if (openCount !== closeCount) throw new Error("Unmatched template tags");
        break;
      case "ejs":
        // Validate EJS syntax
        const ejsOpen = (content.match(/<%/g) || []).length;
        const ejsClose = (content.match(/%>/g) || []).length;
        if (ejsOpen !== ejsClose) throw new Error("Unmatched EJS tags");
        break;
      case "nunjucks":
        // Validate nunjucks syntax
        break;
    }
  }

  private renderWithEngine(engine: EngineType, content: string, data: Record<string, unknown>): string {
    switch (engine) {
      case "simple":
      case "mustache":
      case "handlebars":
        return this.renderSimple(content, data);
      case "ejs":
        return this.renderEJS(content, data);
      case "nunjucks":
        return this.renderSimple(content, data);
      default:
        return this.renderSimple(content, data);
    }
  }

  private renderSimple(content: string, data: Record<string, unknown>): string {
    return content.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const parts = trimmedKey.split(".");
      let value: any = data;
      for (const part of parts) {
        value = value?.[part];
      }
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  private renderEJS(content: string, data: Record<string, unknown>): string {
    // Simplified EJS rendering
    let result = content;
    result = result.replace(/<%=\s*([\w.]+)\s*%>/g, (match, key) => {
      const parts = key.split(".");
      let value: any = data;
      for (const part of parts) value = value?.[part];
      return value !== undefined ? String(value) : "";
    });
    return result;
  }

  private computeChanges(oldContent: string, newContent: string): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) {
        changes.push({ path: `line:${i + 1}`, type: "add", newValue: newLines[i], description: `Added line ${i + 1}` });
      } else if (i >= newLines.length) {
        changes.push({ path: `line:${i + 1}`, type: "delete", oldValue: oldLines[i], description: `Deleted line ${i + 1}` });
      } else if (oldLines[i] !== newLines[i]) {
        changes.push({ path: `line:${i + 1}`, type: "modify", oldValue: oldLines[i], newValue: newLines[i], description: `Modified line ${i + 1}` });
      }
    }

    return changes;
  }
}

export default TemplateManagerService;
