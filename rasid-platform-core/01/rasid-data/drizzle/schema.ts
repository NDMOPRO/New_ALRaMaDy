import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Slide Element Library ─────────────────────────────────────────

/**
 * Uploaded reference PPTX templates.
 * Admin uploads a PPTX file, system decomposes it into reusable elements.
 */
export const slideTemplates = mysqlTable("slide_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Display name for the template */
  name: varchar("name", { length: 255 }).notNull(),
  /** Description of the template's purpose/style */
  description: text("description"),
  /** S3 URL of the original uploaded PPTX file */
  fileUrl: text("fileUrl"),
  /** S3 key for the original file */
  fileKey: varchar("fileKey", { length: 512 }),
  /** Total number of slides in the original PPTX */
  slideCount: int("slideCount").default(0),
  /** Number of elements extracted from this template */
  elementCount: int("elementCount").default(0),
  /** Processing status */
  status: mysqlEnum("status", ["uploading", "processing", "ready", "failed"]).default("uploading").notNull(),
  /** Error message if processing failed */
  errorMessage: text("errorMessage"),
  /** Admin who uploaded this template */
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SlideTemplate = typeof slideTemplates.$inferSelect;
export type InsertSlideTemplate = typeof slideTemplates.$inferInsert;

/**
 * Element categories for organizing library elements.
 * Examples: kpi_card, colored_pillars, data_table, process_flow, etc.
 */
export const elementCategories = mysqlTable("element_categories", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique slug identifier (e.g., 'kpi_card', 'data_table') */
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** Display name in Arabic */
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  /** Display name in English */
  nameEn: varchar("nameEn", { length: 255 }).notNull(),
  /** Description of this category */
  description: text("description"),
  /** Material icon name */
  icon: varchar("icon", { length: 100 }).default("widgets"),
  /** Display order */
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ElementCategory = typeof elementCategories.$inferSelect;
export type InsertElementCategory = typeof elementCategories.$inferInsert;

/**
 * Individual design elements extracted from templates.
 * Each element is a reusable design pattern (layout, infographic, chart, etc.)
 * that the AI generation engine can reference when creating presentations.
 */
export const slideElements = mysqlTable("slide_elements", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to the source template */
  templateId: int("templateId"),
  /** Reference to the category */
  categoryId: int("categoryId"),
  /** Display name for this element */
  name: varchar("name", { length: 255 }).notNull(),
  /** Detailed description of the element's design */
  description: text("description"),
  /** The slide number in the original PPTX where this element was found */
  sourceSlideNumber: int("sourceSlideNumber"),
  /** S3 URL of the element preview image (screenshot of the slide region) */
  previewUrl: text("previewUrl"),
  /** S3 key for the preview image */
  previewKey: varchar("previewKey", { length: 512 }),
  /**
   * JSON template describing the element's structure.
   * This is what the AI uses to recreate this design pattern.
   * Contains: layout positions, colors, fonts, content structure, etc.
   */
  designTemplate: json("designTemplate"),
  /**
   * JSON describing the element's visual properties.
   * Colors, gradients, borders, shadows, spacing, etc.
   */
  styleProperties: json("styleProperties"),
  /**
   * JSON array of content slots this element expects.
   * e.g., [{ name: "title", type: "text" }, { name: "value", type: "number" }]
   */
  contentSlots: json("contentSlots"),
  /** Whether this element is enabled for AI generation */
  isActive: boolean("isActive").default(true).notNull(),
  /** Number of times this element has been used in generated presentations */
  usageCount: int("usageCount").default(0),
  /** Quality rating (1-5) set by admin */
  qualityRating: int("qualityRating").default(3),
  /**
   * Full HTML template code for this element.
   * Complete standalone HTML (1280x720 slide) with CSS, Chart.js, Arabic fonts.
   * This is the actual visual representation rendered in the library preview.
   */
  htmlTemplate: text("htmlTemplate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SlideElement = typeof slideElements.$inferSelect;
export type InsertSlideElement = typeof slideElements.$inferInsert;

/**
 * Usage rules that define when an element should be used during AI generation.
 * An element can have multiple rules (e.g., "use for KPI display" AND "use for summary slides").
 */
export const elementUsageRules = mysqlTable("element_usage_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to the element */
  elementId: int("elementId").notNull(),
  /**
   * The content context that triggers this element's use.
   * Examples: 'kpi_display', 'comparison', 'timeline', 'risk_matrix',
   * 'process_flow', 'data_summary', 'strategic_pillars', 'compliance_table'
   */
  triggerContext: varchar("triggerContext", { length: 100 }).notNull(),
  /** Human-readable description of when to use this element */
  ruleDescription: text("ruleDescription"),
  /** Priority when multiple elements match the same context (higher = preferred) */
  priority: int("priority").default(5),
  /** Whether this rule is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ElementUsageRule = typeof elementUsageRules.$inferSelect;
export type InsertElementUsageRule = typeof elementUsageRules.$inferInsert;
