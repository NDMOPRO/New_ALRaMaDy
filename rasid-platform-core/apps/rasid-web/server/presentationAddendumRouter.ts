/**
 * Presentation Addendum Router — tRPC procedures for the ADDENDUM features:
 * Catalog, Control Manifest, Transforms, Data Picker, Dashboard Slides,
 * Literal Verification, Tool Schemas
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getCatalog } from "./engines/presentationCatalogs";
import {
  buildControlManifest,
  getVisibleControls,
  searchControls,
  inferIntentFromPrompt,
  resolveSmartDefaults,
  loadUserPreferences,
  saveUserPreferences,
  defaultUserPreferences,
  applyElementTransform,
  browseExcelFile,
  selectDataFromExcel,
  applyDataBinding,
  generateDashboardSlide,
  computeLiteralHash,
  verifyLiteralFidelity,
  PRESENTATION_TOOL_SCHEMAS,
} from "./engines/presentationControlManifest";
import * as path from "node:path";
import * as os from "node:os";

const ROOT_DIR = process.env.RASID_DATA_DIR || path.join(os.tmpdir(), "rasid-addendum-data");

export const presentationAddendumRouter = router({

  // ═══════════════════════════════════════════════════════════════
  // CATALOG
  // ═══════════════════════════════════════════════════════════════

  catalogSearch: publicProcedure
    .input(z.object({
      kind: z.string().optional(),
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().optional(),
    }))
    .query(({ input }) => {
      const catalog = getCatalog();
      return catalog.search({
        kind: (input.kind as any) || undefined,
        query: input.query,
        tags: input.tags,
        limit: input.limit || 20,
      });
    }),

  catalogStats: publicProcedure.query(() => {
    const catalog = getCatalog();
    return catalog.getStats();
  }),

  catalogFamilies: publicProcedure
    .input(z.object({ kind: z.string() }))
    .query(({ input }) => {
      const catalog = getCatalog();
      return catalog.getFamiliesForKind(input.kind as any);
    }),

  catalogVariants: publicProcedure
    .input(z.object({
      asset_id: z.string(),
      count: z.number().optional(),
      direction: z.enum(["more_like_this", "different_direction", "simpler", "more_complex"]).optional(),
      seed: z.number().optional(),
    }))
    .query(({ input }) => {
      const catalog = getCatalog();
      return catalog.generateVariants({
        asset_id: input.asset_id,
        count: input.count || 6,
        direction: input.direction || "more_like_this",
        seed: input.seed,
      });
    }),

  // ═══════════════════════════════════════════════════════════════
  // CONTROL MANIFEST
  // ═══════════════════════════════════════════════════════════════

  controlManifestBuild: publicProcedure
    .input(z.object({
      prompt: z.string().optional(),
      language: z.string().optional(),
      userId: z.string().optional(),
    }))
    .query(({ input }) => {
      const userId = input.userId || "anonymous";
      const prefs = defaultUserPreferences(userId);
      return buildControlManifest(input.prompt || "", input.language || "ar", prefs);
    }),

  controlManifestVisible: publicProcedure
    .input(z.object({
      level: z.enum(["deck", "slide", "element", "none"]),
      prompt: z.string().optional(),
      language: z.string().optional(),
    }))
    .query(({ input }) => {
      const prefs = defaultUserPreferences("anonymous");
      const manifest = buildControlManifest(input.prompt || "", input.language || "ar", prefs);
      return getVisibleControls(manifest, input.level);
    }),

  controlManifestSearch: publicProcedure
    .input(z.object({
      query: z.string(),
      prompt: z.string().optional(),
      language: z.string().optional(),
    }))
    .query(({ input }) => {
      const prefs = defaultUserPreferences("anonymous");
      const manifest = buildControlManifest(input.prompt || "", input.language || "ar", prefs);
      return searchControls(manifest, input.query);
    }),

  // ═══════════════════════════════════════════════════════════════
  // INTENT + SMART DEFAULTS
  // ═══════════════════════════════════════════════════════════════

  intentInfer: publicProcedure
    .input(z.object({
      prompt: z.string(),
      language: z.string().optional(),
    }))
    .query(({ input }) => {
      return inferIntentFromPrompt(input.prompt, input.language || "ar");
    }),

  smartDefaults: publicProcedure
    .input(z.object({
      prompt: z.string(),
      language: z.string().optional(),
      userId: z.string().optional(),
    }))
    .query(({ input }) => {
      const prefs = defaultUserPreferences(input.userId || "anonymous");
      return resolveSmartDefaults(input.prompt, input.language || "ar", prefs);
    }),

  // ═══════════════════════════════════════════════════════════════
  // USER PREFERENCES
  // ═══════════════════════════════════════════════════════════════

  preferencesGet: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(({ input }) => {
      const userId = input.userId || "anonymous";
      try {
        return loadUserPreferences(ROOT_DIR, userId);
      } catch {
        return defaultUserPreferences(userId);
      }
    }),

  preferencesSave: publicProcedure
    .input(z.object({
      userId: z.string(),
      default_slide_count: z.number().optional(),
      default_language: z.string().optional(),
      default_theme: z.string().optional(),
      default_font_heading: z.string().optional(),
      default_font_body: z.string().optional(),
      default_layout_family: z.string().optional(),
      preferred_chart_type: z.string().optional(),
      preferred_table_style: z.string().optional(),
      preferred_motion_preset: z.string().optional(),
      show_advanced_controls: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const existing = defaultUserPreferences(input.userId);
      const updated = { ...existing, ...input };
      try {
        saveUserPreferences(ROOT_DIR, updated);
      } catch { /* ignore if dir doesn't exist */ }
      return updated;
    }),

  // ═══════════════════════════════════════════════════════════════
  // ELEMENT TRANSFORM
  // ═══════════════════════════════════════════════════════════════

  elementTransform: publicProcedure
    .input(z.object({
      deck_id: z.string(),
      slide_ref: z.string(),
      element_ref: z.string(),
      transform_kind: z.string(),
      new_value: z.string().optional(),
      parameters: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(({ input }) => {
      return applyElementTransform({
        deck_id: input.deck_id,
        slide_ref: input.slide_ref,
        element_ref: input.element_ref,
        transform_kind: input.transform_kind as any,
        new_value: input.new_value,
        parameters: input.parameters,
      });
    }),

  // ═══════════════════════════════════════════════════════════════
  // DATA PICKER
  // ═══════════════════════════════════════════════════════════════

  dataPickerBrowse: publicProcedure
    .input(z.object({
      file_path: z.string(),
      sheet_name: z.string().optional(),
    }))
    .query(({ input }) => {
      return browseExcelFile(input);
    }),

  dataPickerSelect: publicProcedure
    .input(z.object({
      file_path: z.string(),
      sheet_name: z.string(),
      columns: z.array(z.string()),
      range: z.string().optional(),
      filters: z.array(z.object({
        column: z.string(),
        operator: z.string(),
        value: z.union([z.string(), z.number()]),
      })).optional(),
      group_by: z.string().optional(),
      sort_by: z.string().optional(),
      sort_order: z.enum(["asc", "desc"]).optional(),
      limit: z.number().optional(),
    }))
    .query(({ input }) => {
      return selectDataFromExcel(input as any);
    }),

  // ═══════════════════════════════════════════════════════════════
  // DATA BINDING
  // ═══════════════════════════════════════════════════════════════

  dataBindingApply: publicProcedure
    .input(z.object({
      deck_id: z.string(),
      slide_ref: z.string(),
      element_ref: z.string(),
      target_type: z.enum(["table", "chart", "kpi"]),
      data_source: z.object({
        file_path: z.string(),
        sheet_name: z.string(),
        columns: z.array(z.string()),
        range: z.string().optional(),
      }),
    }))
    .mutation(({ input }) => {
      return applyDataBinding(input);
    }),

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD SLIDE
  // ═══════════════════════════════════════════════════════════════

  dashboardSlideGenerate: publicProcedure
    .input(z.object({
      deck_id: z.string(),
      title: z.string(),
      kpi_metrics: z.array(z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        trend: z.enum(["up", "down", "flat"]).optional(),
        target: z.number().optional(),
      })),
      mini_charts: z.array(z.object({
        chart_type: z.string(),
        label: z.string(),
        data_points: z.array(z.number()),
      })).optional(),
      filter_controls: z.array(z.object({
        filter_id: z.string(),
        label: z.string(),
        type: z.enum(["dropdown", "date_range", "toggle"]),
        options: z.array(z.string()).optional(),
      })).optional(),
    }))
    .mutation(({ input }) => {
      return generateDashboardSlide(input as any);
    }),

  // ═══════════════════════════════════════════════════════════════
  // LITERAL VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  literalVerify: publicProcedure
    .input(z.object({
      input_text: z.string(),
      output_text: z.string(),
    }))
    .query(({ input }) => {
      return verifyLiteralFidelity(input.input_text, input.output_text);
    }),

  literalHash: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return { hash: computeLiteralHash(input.text) };
    }),

  // ═══════════════════════════════════════════════════════════════
  // TOOL SCHEMAS
  // ═══════════════════════════════════════════════════════════════

  toolSchemas: publicProcedure.query(() => {
    return PRESENTATION_TOOL_SCHEMAS;
  }),
});
